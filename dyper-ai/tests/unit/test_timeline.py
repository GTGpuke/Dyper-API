"""Tests unitaires du lissage de la chronologie d'apparition (comblement des trous)."""

import pytest
from app.routes.process import fill_track_gaps
from app.schemas.response import DetectedObject, FrameDetections


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
