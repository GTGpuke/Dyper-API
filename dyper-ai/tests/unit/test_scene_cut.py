"""Tests unitaires de la détection de coupures de plan (réinitialisation du suivi entre clips)."""

import pytest
from app.services.scene_cut import SceneCutDetector, frame_signature, scene_change_score
from PIL import Image


def _solid(rgb: tuple[int, int, int], size: int = 64) -> Image.Image:
    """Image RGB unie de la couleur donnée."""
    return Image.new("RGB", (size, size), rgb)


@pytest.mark.unit
class TestSceneChangeScore:
    """Tests de la signature de frame et de l'écart combiné couleur/structure."""

    def test_frames_identiques_ecart_nul(self):
        """Vérifie que deux frames identiques ont un écart nul."""
        sig = frame_signature(_solid((120, 120, 120)))
        assert scene_change_score(sig, frame_signature(_solid((120, 120, 120)))) == pytest.approx(
            0.0
        )

    def test_luminosite_opposee_ecart_eleve(self):
        """Vérifie qu'un noir vs un blanc (structure) donne un écart proche de 1."""
        score = scene_change_score(
            frame_signature(_solid((0, 0, 0))), frame_signature(_solid((255, 255, 255)))
        )
        assert score > 0.9

    def test_couleurs_differentes_ecart_eleve(self):
        """Vérifie qu'un changement de teinte (rouge → vert) est bien capté par l'histogramme couleur."""
        score = scene_change_score(
            frame_signature(_solid((255, 0, 0))), frame_signature(_solid((0, 200, 0)))
        )
        assert score > 0.5


@pytest.mark.unit
class TestSceneCutDetector:
    """Tests du détecteur de coupure (pic adaptatif, état : frame précédente + base récente)."""

    def test_premiere_frame_pas_de_coupure(self):
        """Vérifie que la toute première frame ne déclenche jamais de coupure."""
        assert SceneCutDetector(0.2).is_cut(_solid((100, 100, 100))) is False

    def test_changement_brutal_declenche_une_coupure(self):
        """Vérifie qu'un changement brutal (noir → blanc) est vu comme une coupure."""
        detector = SceneCutDetector(0.2)
        detector.is_cut(_solid((0, 0, 0)))
        assert detector.is_cut(_solid((255, 255, 255))) is True

    def test_changement_de_teinte_declenche_une_coupure(self):
        """Vérifie qu'un changement de couleur franc (rouge → vert) déclenche une coupure."""
        detector = SceneCutDetector(0.2)
        detector.is_cut(_solid((255, 0, 0)))
        assert detector.is_cut(_solid((0, 200, 0))) is True

    def test_frame_quasi_identique_pas_de_coupure(self):
        """Vérifie qu'un changement infime (même plan) ne déclenche pas de coupure."""
        detector = SceneCutDetector(0.2)
        detector.is_cut(_solid((120, 120, 120)))
        assert detector.is_cut(_solid((121, 121, 121))) is False

    def test_seuil_nul_desactive(self):
        """Vérifie qu'un plancher ≤ 0 désactive complètement la détection."""
        detector = SceneCutDetector(0.0)
        detector.is_cut(_solid((0, 0, 0)))
        assert detector.is_cut(_solid((255, 255, 255))) is False
