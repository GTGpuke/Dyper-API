"""Suivi multi-objets sur mesure pour la vidéo : association par coût explicite.

Remplace le tracker d'ultralytics afin de maîtriser entièrement l'association et d'unifier les
identités COCO + vocabulaire ouvert dans un seul espace. À chaque frame, chaque détection est
rapprochée des pistes existantes par un COÛT combinant quatre signaux :
  - MOUVEMENT  : distance entre la détection et la position PRÉDITE de la piste (depuis sa vitesse) ;
  - POSITION   : 1 − IoU entre la boîte prédite et la détection ;
  - LABEL      : pénalité si les classes diffèrent, sauf entre classes confondues (ex. car/truck) ;
  - APPARENCE  : distance entre couleurs moyennes (départage deux objets de même classe).
L'affectation est gloutonne (coût croissant) sous un plafond ; une piste non vue est prédite puis
oubliée après `TRACK_MAX_AGE` frames (tolérance aux occlusions et détections manquées). Ainsi
l'identité ne saute plus brutalement : la position/mouvement prime, l'apparence départage, le
label gate les confusions inter-classes. Toutes les pondérations sont réglables (cf. config.py).
"""

import numpy as np
from PIL import Image

from app.config import settings
from app.schemas.response import BoundingBox, DetectedObject
from app.services.fusion import iou

# Distance RGB maximale (sqrt(3 × 255²)) pour normaliser l'écart de couleur dans [0, 1].
_MAX_COLOR_DISTANCE = float(np.sqrt(3) * 255)
# Lissage exponentiel de la vitesse estimée (réactif sans être bruité).
_VELOCITY_SMOOTHING = 0.6

# Classes mutuellement confondues par le détecteur (même objet réel sous des labels voisins) :
# la pénalité de label NE s'applique PAS entre elles, sinon une piste se casse quand le modèle
# hésite (une voiture tantôt « car », tantôt « truck »/« bus » resterait la même piste).
_CONFUSABLE_GROUPS: tuple[frozenset[str], ...] = (
    frozenset({"car", "truck", "bus", "van", "suv", "pickup truck", "minivan"}),
    frozenset({"person", "man", "woman", "boy", "girl", "pedestrian", "child"}),
)
_GROUP_OF: dict[str, int] = {
    label: index for index, group in enumerate(_CONFUSABLE_GROUPS) for label in group
}


def _same_group(a: str, b: str) -> bool:
    """Vrai si deux labels sont identiques ou appartiennent au même groupe de classes confondues."""
    if a == b:
        return True
    group_a = _GROUP_OF.get(a.lower())
    return group_a is not None and group_a == _GROUP_OF.get(b.lower())


def _mean_color(image: np.ndarray, box: BoundingBox) -> np.ndarray | None:
    """Couleur RGB moyenne de la région d'une boîte (None si la découpe est vide ou hors cadre)."""
    if image.ndim != 3 or image.shape[2] < 3:
        return None
    height, width = image.shape[0], image.shape[1]
    x1 = max(0, int(box.x))
    y1 = max(0, int(box.y))
    x2 = min(width, int(box.x + box.w))
    y2 = min(height, int(box.y + box.h))
    if x2 <= x1 or y2 <= y1:
        return None
    crop = image[y1:y2, x1:x2, :3]
    return crop.reshape(-1, 3).mean(axis=0).astype(np.float32)


def _color_distance(a: np.ndarray | None, b: np.ndarray | None) -> float:
    """Écart de couleur normalisé dans [0, 1] ; neutre (0.5) si une apparence est inconnue."""
    if a is None or b is None:
        return 0.5
    return float(np.linalg.norm(a - b)) / _MAX_COLOR_DISTANCE


class _Track:
    """État interne d'une piste : centre, taille, vitesse, apparence et vote de label."""

    __slots__ = ("id", "cx", "cy", "w", "h", "vx", "vy", "color", "label_votes", "misses")

    def __init__(
        self, track_id: int, box: BoundingBox, color: np.ndarray | None, label: str, conf: float
    ) -> None:
        """Initialise une piste à partir de sa première détection."""
        self.id = track_id
        self.cx = box.x + box.w / 2
        self.cy = box.y + box.h / 2
        self.w = box.w
        self.h = box.h
        self.vx = 0.0
        self.vy = 0.0
        self.color = color
        self.label_votes: dict[str, float] = {label: conf}
        self.misses = 0

    @property
    def label(self) -> str:
        """Label dominant de la piste (vote pondéré par la confiance) — sert à la pénalité de label."""
        return max(self.label_votes.items(), key=lambda kv: kv[1])[0]

    def predicted_box(self) -> BoundingBox:
        """Boîte attendue à la frame suivante (position courante + vitesse, taille conservée)."""
        return BoundingBox(
            x=self.cx + self.vx - self.w / 2, y=self.cy + self.vy - self.h / 2, w=self.w, h=self.h
        )

    def absorb(self, box: BoundingBox, color: np.ndarray | None, label: str, conf: float) -> None:
        """Met à jour la piste avec une détection appariée (position, vitesse lissée, apparence)."""
        ncx = box.x + box.w / 2
        ncy = box.y + box.h / 2
        self.vx = (1 - _VELOCITY_SMOOTHING) * self.vx + _VELOCITY_SMOOTHING * (ncx - self.cx)
        self.vy = (1 - _VELOCITY_SMOOTHING) * self.vy + _VELOCITY_SMOOTHING * (ncy - self.cy)
        self.cx, self.cy, self.w, self.h = ncx, ncy, box.w, box.h
        if color is not None:
            self.color = color if self.color is None else 0.5 * self.color + 0.5 * color
        self.label_votes[label] = self.label_votes.get(label, 0.0) + conf
        self.misses = 0


class ObjectTracker:
    """Tracker en ligne : assigne des identifiants de piste stables aux détections fusionnées.

    Une instance par vidéo (état réinitialisé). Les objets sans boîte conservent un `trackId` nul
    (non suivables) ; les autres reçoivent l'identité de leur piste.
    """

    def __init__(self) -> None:
        """Initialise un tracker vide (aucune piste, compteur d'identifiants à 1)."""
        self._tracks: list[_Track] = []
        self._next_id = 1

    def reset(self) -> None:
        """Vide les pistes actives (coupure de plan) — les identifiants déjà émis ne sont pas réutilisés."""
        self._tracks = []

    def _cost(
        self, track: _Track, box: BoundingBox, color: np.ndarray | None, label: str, diag: float
    ) -> float:
        """Coût d'association d'une détection à une piste (plus il est bas, plus c'est probable)."""
        center_dist = (
            float(
                np.hypot(
                    box.x + box.w / 2 - (track.cx + track.vx),
                    box.y + box.h / 2 - (track.cy + track.vy),
                )
            )
            / diag
        )
        iou_term = 1.0 - iou(track.predicted_box(), box)
        color_term = _color_distance(track.color, color)
        # Écart de taille (échelle) avec bande de tolérance : AUCUNE pénalité tant que les dimensions
        # restent dans un facteur raisonnable (jitter normal, fréquent sur les PETITES boîtes comme des
        # lunettes), puis la pénalité monte pour un saut d'échelle BRUTAL (objet surgissant). On prend la
        # pire des deux dimensions (capte aussi un changement d'aspect). En deçà de TRACK_SIZE_TOLERANCE,
        # le ratio est jugé normal → 0 ; vers 0 (très différent) → 1.
        w_ratio = min(track.w, box.w) / max(track.w, box.w, 1e-6)
        h_ratio = min(track.h, box.h) / max(track.h, box.h, 1e-6)
        size_term = max(0.0, 1.0 - min(w_ratio, h_ratio) / settings.TRACK_SIZE_TOLERANCE)
        label_term = 0.0 if _same_group(track.label, label) else settings.TRACK_LABEL_PENALTY
        return (
            settings.TRACK_W_MOTION * center_dist
            + settings.TRACK_W_IOU * iou_term
            + settings.TRACK_W_APPEARANCE * color_term
            + settings.TRACK_W_SIZE * size_term
            + label_term
        )

    def update(self, objects: list[DetectedObject], image: Image.Image) -> list[DetectedObject]:
        """Associe `objects` aux pistes, renseigne leur `trackId` en place et retourne `objects`."""
        frame = np.asarray(image)
        height, width = (frame.shape[0], frame.shape[1]) if frame.ndim >= 2 else (1, 1)
        diag = float(np.hypot(width, height)) or 1.0

        trackable = [obj for obj in objects if obj.boundingBox is not None]
        colors = [_mean_color(frame, obj.boundingBox) for obj in trackable]  # type: ignore[arg-type]

        # Coûts candidats (piste, détection) sous le plafond d'association.
        candidates: list[tuple[float, int, int]] = []
        for ti, track in enumerate(self._tracks):
            for di, obj in enumerate(trackable):
                assert obj.boundingBox is not None  # Garanti par le filtre `trackable`.
                cost = self._cost(track, obj.boundingBox, colors[di], obj.label, diag)
                if cost <= settings.TRACK_MAX_COST:
                    candidates.append((cost, ti, di))

        # Affectation gloutonne : on prend les paires de coût croissant, une piste/détection au plus.
        candidates.sort(key=lambda candidate: candidate[0])
        matched_track_idx: set[int] = set()
        det_to_track_idx: dict[int, int] = {}
        for _cost, ti, di in candidates:
            if ti in matched_track_idx or di in det_to_track_idx:
                continue
            matched_track_idx.add(ti)
            det_to_track_idx[di] = ti

        # Mise à jour des pistes appariées et création des nouvelles (détections orphelines).
        new_tracks: list[_Track] = []
        for di, obj in enumerate(trackable):
            box = obj.boundingBox
            assert box is not None
            if di in det_to_track_idx:
                track = self._tracks[det_to_track_idx[di]]
                track.absorb(box, colors[di], obj.label, obj.confidence)
                obj.trackId = track.id
            else:
                track = _Track(self._next_id, box, colors[di], obj.label, obj.confidence)
                self._next_id += 1
                new_tracks.append(track)
                obj.trackId = track.id

        # Vieillissement : les pistes non vues cette frame sont conservées (prédites) jusqu'à
        # `TRACK_MAX_AGE` frames manquées, puis oubliées.
        survivors: list[_Track] = []
        for ti, track in enumerate(self._tracks):
            if ti in matched_track_idx:
                survivors.append(track)
            else:
                track.misses += 1
                if track.misses <= settings.TRACK_MAX_AGE:
                    survivors.append(track)
        self._tracks = survivors + new_tracks

        return objects
