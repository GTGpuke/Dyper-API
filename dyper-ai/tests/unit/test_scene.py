"""Tests unitaires pour l'inférence de scène à partir des objets détectés."""

import pytest

from app.schemas.response import DetectedObject
from app.services.scene import infer_scene


def _make_objects(*labels: str) -> list:
    """Crée une liste de DetectedObject à partir d'une suite de labels."""
    return [DetectedObject(label=lbl, confidence=0.85) for lbl in labels]


@pytest.mark.unit
class TestInferScene:
    """Tests de la fonction infer_scene."""

    def test_scene_defaut_sans_objets(self):
        """Vérifie que la scène par défaut est retournée si aucun objet n'est détecté."""
        scene = infer_scene([])
        assert scene.label == "scène générale"
        assert scene.confidence == 0.5

    def test_priorite1_avion(self):
        """Vérifie la détection de la scène aéroport avec un avion."""
        scene = infer_scene(_make_objects("airplane"))
        assert scene.label == "aéroport / zone aérienne"
        assert scene.indoor is False

    def test_priorite1_bateau(self):
        """Vérifie la détection de la scène port avec un bateau."""
        scene = infer_scene(_make_objects("boat"))
        assert scene.label == "port / étendue d'eau"

    def test_priorite2_ski(self):
        """Vérifie la détection d'un domaine skiable avec skis et snowboard."""
        scene = infer_scene(_make_objects("skis", "snowboard"))
        assert scene.label == "domaine skiable / montagne enneigée"

    def test_priorite3_animaux_sauvages(self):
        """Vérifie la détection d'un zoo avec des animaux sauvages."""
        scene = infer_scene(_make_objects("elephant", "giraffe"))
        assert scene.label == "zoo / safari"

    def test_priorite4_circulation(self):
        """Vérifie la détection d'une rue avec une voiture."""
        scene = infer_scene(_make_objects("car", "traffic light"))
        assert scene.label == "rue / circulation urbaine"

    def test_priorite6_cuisine(self):
        """Vérifie la détection d'une cuisine avec un four et un micro-ondes."""
        scene = infer_scene(_make_objects("microwave", "oven"))
        assert scene.label == "cuisine"
        assert scene.indoor is True

    def test_priorite6_chambre(self):
        """Vérifie la détection d'une chambre avec un lit."""
        scene = infer_scene(_make_objects("bed", "teddy bear"))
        assert scene.label == "chambre à coucher"

    def test_priorite8_bureau(self):
        """Vérifie la détection d'un bureau avec un laptop."""
        scene = infer_scene(_make_objects("laptop", "keyboard"))
        assert scene.label == "bureau / espace de travail"

    def test_priorite10_foule_5_personnes(self):
        """Vérifie la détection d'une foule avec 5 personnes ou plus."""
        scene = infer_scene(_make_objects("person", "person", "person", "person", "person"))
        assert scene.label == "foule / espace public"

    def test_priorite10_groupe_3_personnes(self):
        """Vérifie la détection d'une scène de groupe avec 2 à 4 personnes."""
        scene = infer_scene(_make_objects("person", "person", "person"))
        assert scene.label == "scène de groupe"

    def test_confiance_calculee(self):
        """Vérifie que la confiance de la scène est la moyenne des confidences des objets matchés."""
        objects = [
            DetectedObject(label="airplane", confidence=0.80),
            DetectedObject(label="airplane", confidence=0.90),
        ]
        scene = infer_scene(objects)
        assert scene.confidence == pytest.approx(0.85, abs=0.01)
