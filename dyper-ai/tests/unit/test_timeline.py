"""Tests unitaires du lissage de la chronologie d'apparition et des labels de piste."""

import pytest
from app.routes.process import (
    build_detection_summary,
    drop_brief_tracks,
    fill_track_gaps,
    stabilize_track_labels,
)
from app.schemas.response import BoundingBox, DetectedObject, FrameDetections


def _frame(t: float, labels_tracks: list[tuple[str, int | None]]) -> FrameDetections:
    """Crée une frame de détections factice à partir de couples (label, trackId)."""
    return FrameDetections(
        t=t,
        objects=[
            DetectedObject(label=label, confidence=0.9, trackId=track)
            for label, track in labels_tracks
        ],
    )


@pytest.mark.unit
class TestFillTrackGaps:
    """Tests de fill_track_gaps."""

    def test_trou_court_comble(self):
        """Vérifie qu'un trou de 1 échantillon dans une piste est comblé (anti-scintillement)."""
        frames = [
            _frame(0.0, [("person", 1)]),
            _frame(1.0, []),  # Détection manquée.
            _frame(2.0, [("person", 1)]),
        ]
        timeline = fill_track_gaps(frames, max_gap=2)
        assert timeline[1].labels == ["person"]

    def test_trou_long_non_comble(self):
        """Vérifie qu'un trou plus large que max_gap n'est pas comblé (vraie absence)."""
        frames = [
            _frame(0.0, [("person", 1)]),
            _frame(1.0, []),
            _frame(2.0, []),
            _frame(3.0, []),
            _frame(4.0, [("person", 1)]),
        ]
        timeline = fill_track_gaps(frames, max_gap=2)
        assert timeline[1].labels == []
        assert timeline[2].labels == []
        assert timeline[3].labels == []

    def test_pistes_distinctes_non_fusionnees(self):
        """Vérifie que deux pistes différentes du même label ne comblent pas l'une l'autre."""
        # person#1 sur les frames 0-1, person#2 sur la frame 4 : trou de 2 entre des pistes
        # DIFFÉRENTES → pas de comblement (l'objet a réellement disparu entre les deux).
        frames = [
            _frame(0.0, [("person", 1)]),
            _frame(1.0, [("person", 1)]),
            _frame(2.0, []),
            _frame(3.0, []),
            _frame(4.0, [("person", 2)]),
        ]
        timeline = fill_track_gaps(frames, max_gap=2)
        assert timeline[2].labels == []
        assert timeline[3].labels == []

    def test_sans_track_id_lissage_par_label(self):
        """Vérifie le repli par label quand le tracker ne fournit pas d'identifiants."""
        frames = [
            _frame(0.0, [("car", None)]),
            _frame(1.0, []),
            _frame(2.0, [("car", None)]),
        ]
        timeline = fill_track_gaps(frames, max_gap=2)
        assert timeline[1].labels == ["car"]

    def test_horodatages_preserves(self):
        """Vérifie que les horodatages des frames sont préservés dans la chronologie."""
        frames = [_frame(0.0, []), _frame(2.5, [("dog", 3)])]
        timeline = fill_track_gaps(frames, max_gap=2)
        assert [entry.t for entry in timeline] == [0.0, 2.5]
        assert timeline[1].labels == ["dog"]


def _obj(label: str, track: int | None, conf: float) -> DetectedObject:
    """Crée un objet détecté avec label, piste et confiance configurables."""
    return DetectedObject(label=label, confidence=conf, trackId=track)


@pytest.mark.unit
class TestStabilizeTrackLabels:
    """Tests du lissage de label par piste (label vu sur le plus de frames, confiance en départage)."""

    def test_label_dominant_reecrit_toutes_les_frames(self):
        """Vérifie que la piste prend son label dominant sur toutes ses frames."""
        frames = [
            FrameDetections(t=0.0, objects=[_obj("car", 1, 0.9)]),
            FrameDetections(t=1.0, objects=[_obj("truck", 1, 0.5)]),
            FrameDetections(t=2.0, objects=[_obj("car", 1, 0.8)]),
        ]
        stabilize_track_labels(frames)
        assert [frame.objects[0].label for frame in frames] == ["car", "car", "car"]

    def test_label_bref_tres_confiant_ne_detourne_pas_la_piste(self):
        """Vérifie qu'un label parasite bref mais très confiant ne capture pas l'identité.

        Cas du chat flou sur un canapé net : « couch » détecté une fois à 0,99 ne doit pas
        l'emporter sur « cat » vu sur davantage de frames, même moins confiantes.
        """
        frames = [
            FrameDetections(t=0.0, objects=[_obj("cat", 7, 0.5)]),
            FrameDetections(t=1.0, objects=[_obj("cat", 7, 0.5)]),
            FrameDetections(t=2.0, objects=[_obj("couch", 7, 0.99)]),
            FrameDetections(t=3.0, objects=[_obj("cat", 7, 0.5)]),
        ]
        stabilize_track_labels(frames)
        assert {frame.objects[0].label for frame in frames} == {"cat"}

    def test_egalite_departagee_par_confiance(self):
        """Vérifie qu'à nombre de frames égal, la confiance cumulée départage le label."""
        frames = [
            FrameDetections(t=0.0, objects=[_obj("car", 7, 0.9)]),
            FrameDetections(t=1.0, objects=[_obj("truck", 7, 0.4)]),
        ]
        stabilize_track_labels(frames)
        assert {frame.objects[0].label for frame in frames} == {"car"}

    def test_objets_sans_piste_inchanges(self):
        """Vérifie que les objets sans trackId (vocabulaire ouvert) ne sont pas touchés."""
        frames = [
            FrameDetections(t=0.0, objects=[_obj("car", None, 0.9)]),
            FrameDetections(t=1.0, objects=[_obj("bus", None, 0.9)]),
        ]
        stabilize_track_labels(frames)
        assert [frame.objects[0].label for frame in frames] == ["car", "bus"]


def _video(times: list[float], present: dict[int, tuple[str, set[int]]]) -> list[FrameDetections]:
    """Construit une séquence : `present` mappe un trackId → (label, indices de frames où il paraît)."""
    frames: list[FrameDetections] = []
    for index, t in enumerate(times):
        objects = [
            _obj(label, track, 0.9)
            for track, (label, frame_indices) in present.items()
            if index in frame_indices
        ]
        frames.append(FrameDetections(t=t, objects=objects))
    return frames


# Cadence d'échantillonnage des tests : 10 img/s (pas de 0,1 s), comme la valeur par défaut.
_T13 = [round(i * 0.1, 1) for i in range(13)]  # 0,0 → 1,2 s.


@pytest.mark.unit
class TestDropBriefTracks:
    """Tests de la persistance CUMULÉE : un objet doit totaliser assez de frames de détection.

    À 10 img/s (pas de 0,1 s) : min_seconds=1.0 → 10 frames minimum, min_seconds=0.5 → 5 frames.
    """

    def test_piste_breve_ecartee(self):
        """Vérifie qu'une piste vue sur trop peu de frames AU TOTAL est retirée, la durable conservée."""
        # cat#1 : 12 frames (1,2 s cumulés). flash#2 : 1 frame. dog#3 : 1 frame.
        frames = _video(
            _T13,
            {1: ("cat", set(range(12))), 2: ("flash", {0}), 3: ("dog", {12})},
        )
        drop_brief_tracks(frames, min_seconds=1.0)
        labels = [obj.label for frame in frames for obj in frame.objects]
        assert "flash" not in labels  # Piste fugace (1 frame) écartée.
        assert "dog" not in labels  # Piste brève écartée.
        assert labels.count("cat") == 12  # Piste durable (≥ 10 frames) conservée.

    def test_intermittence_conservee(self):
        """Vérifie qu'un objet du vocabulaire ouvert détecté PAR INTERMITTENCE est conservé (richesse).

        Cas des mug / cup / glasses / suit : le détecteur ouvert clignote (frames non consécutives,
        trous parfois longs) mais l'objet est bien présent. Le cumul de frames suffit → conservé,
        là où un critère de présence CONTINUE l'éliminait à tort.
        """
        # mug#9 : 7 frames très espacées (indices 0,2,4,6,8,10,12), aucune consécutive — 0,7 s cumulés.
        frames = _video(
            _T13,
            {1: ("road", set(range(13))), 9: ("mug", {0, 2, 4, 6, 8, 10, 12})},
        )
        drop_brief_tracks(frames, min_seconds=0.5)  # 0,5 s → 5 frames minimum.
        labels = [obj.label for frame in frames for obj in frame.objects]
        assert labels.count("mug") == 7  # 7 frames cumulées ≥ 5 → conservée malgré l'intermittence.

    def test_piste_sur_toute_la_sequence_conservee(self):
        """Vérifie qu'une piste présente sur TOUT le clip court (< min_seconds) n'est jamais filtrée."""
        frames = _video([0.0, 0.3], {1: ("dog", {0, 1})})
        drop_brief_tracks(frames, min_seconds=1.0)
        assert [obj.label for frame in frames for obj in frame.objects] == ["dog", "dog"]

    def test_objets_sans_piste_conserves(self):
        """Vérifie que les détections sans trackId ne sont jamais filtrées."""
        frames = _video(_T13, {1: ("road", set(range(13)))})
        frames[0].objects.append(_obj("musique", None, 0.8))  # Objet non suivi sur une seule frame.
        drop_brief_tracks(frames, min_seconds=1.0)
        assert "musique" in [obj.label for frame in frames for obj in frame.objects]

    def test_listes_miroir_filtrees_aussi(self):
        """Vérifie que les listes miroir (objets agrégés) sont filtrées de la même piste fugace."""
        frames = _video(_T13, {1: ("dog", set(range(13))), 9: ("necklace", {0})})
        agrege = [_obj("dog", 1, 0.9), _obj("necklace", 9, 0.7)]
        drop_brief_tracks(frames, min_seconds=1.0, mirrors=[agrege])
        assert [obj.label for obj in agrege] == ["dog"]  # La piste fugace 9 a disparu du miroir.

    def test_seuil_zero_desactive_le_filtre(self):
        """Vérifie qu'un seuil ≤ 0 conserve toutes les pistes (filtre désactivé)."""
        frames = _video([0.0, 0.5], {2: ("birdbath", {0}), 3: ("wall", {1})})
        drop_brief_tracks(frames, min_seconds=0.0)
        assert [obj.label for frame in frames for obj in frame.objects] == ["birdbath", "wall"]


@pytest.mark.unit
class TestBuildDetectionSummary:
    """Tests du résumé de détection (label, position, durée) pour la synthèse de description."""

    def _frame(self, t: float, objects: list[DetectedObject]) -> FrameDetections:
        """Crée une frame de détections."""
        return FrameDetections(t=t, objects=objects)

    def _boxed(self, label: str, track: int | None, x: float, y: float) -> DetectedObject:
        """Crée une détection avec piste et boîte 10×10 au coin (x, y)."""
        return DetectedObject(
            label=label,
            confidence=0.9,
            trackId=track,
            boundingBox=BoundingBox(x=x, y=y, w=10, h=10),
        )

    def test_resume_label_cote_presence(self):
        """Vérifie qu'une piste est résumée avec label, côté et présence qualitative (sans secondes)."""
        frames = [
            self._frame(0.0, [self._boxed("car", 1, 5, 5)]),
            self._frame(2.0, [self._boxed("car", 1, 5, 5)]),
        ]
        summary = build_detection_summary(frames, 100, 100, "fr")
        assert summary is not None
        assert summary.startswith("car (à gauche,")
        assert "tout du long" in summary
        assert "s)" not in summary  # Aucune durée en secondes ne doit fuiter.

    def test_aucune_piste_retourne_none(self):
        """Vérifie qu'aucune piste suivie (trackId nul) donne None."""
        frames = [self._frame(0.0, [self._boxed("car", None, 5, 5)])]
        assert build_detection_summary(frames, 100, 100, "fr") is None

    def test_dimensions_inconnues_retourne_none(self):
        """Vérifie que des dimensions de référence inconnues donnent None."""
        frames = [self._frame(0.0, [self._boxed("car", 1, 5, 5)])]
        assert build_detection_summary(frames, None, None, "fr") is None

    def test_position_cote_droit_en_anglais(self):
        """Vérifie le côté « right » en anglais pour un objet à droite de l'image."""
        frames = [self._frame(0.0, [self._boxed("car", 1, 85, 85)])]
        summary = build_detection_summary(frames, 100, 100, "en")
        assert summary is not None
        assert summary.startswith("car (right,")
