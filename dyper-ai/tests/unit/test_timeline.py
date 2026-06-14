"""Tests unitaires du lissage de la chronologie d'apparition et des labels de piste."""

import pytest
from app.routes.process import build_detection_summary, fill_track_gaps, stabilize_track_labels
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
    """Tests du lissage de label par piste (label le plus probable, pondéré par la confiance)."""

    def test_label_dominant_reecrit_toutes_les_frames(self):
        """Vérifie que la piste prend son label dominant sur toutes ses frames."""
        frames = [
            FrameDetections(t=0.0, objects=[_obj("car", 1, 0.9)]),
            FrameDetections(t=1.0, objects=[_obj("truck", 1, 0.5)]),
            FrameDetections(t=2.0, objects=[_obj("car", 1, 0.8)]),
        ]
        stabilize_track_labels(frames)
        assert [frame.objects[0].label for frame in frames] == ["car", "car", "car"]

    def test_vote_pondere_par_confiance(self):
        """Vérifie que la confiance prime sur le simple nombre d'occurrences."""
        # « truck » 2× à 0,3 (= 0,6) contre « car » 1× à 0,9 → « car » l'emporte.
        frames = [
            FrameDetections(t=0.0, objects=[_obj("truck", 7, 0.3)]),
            FrameDetections(t=1.0, objects=[_obj("truck", 7, 0.3)]),
            FrameDetections(t=2.0, objects=[_obj("car", 7, 0.9)]),
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
