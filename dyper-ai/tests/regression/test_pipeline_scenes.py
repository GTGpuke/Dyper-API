"""Tests de régression des scénarios de scènes complets."""

import pytest

from app.schemas.response import DetectedObject
from app.services.scene import infer_scene


def _objs(*labels: str) -> list:
    """Crée des DetectedObject à partir de labels pour les tests de scénarios."""
    return [DetectedObject(label=lbl, confidence=0.88) for lbl in labels]


@pytest.mark.regression
class TestPipelineScenes:
    """Tests de scénarios complets de détection de scènes."""

    def test_scenario_cuisine_complete(self):
        """Vérifie la détection d'une cuisine avec plusieurs équipements."""
        scene = infer_scene(_objs("microwave", "oven", "refrigerator", "sink"))
        assert scene.label == "cuisine"
        assert scene.indoor is True

    def test_scenario_salon_complet(self):
        """Vérifie la détection d'un salon avec TV, canapé et télécommande."""
        scene = infer_scene(_objs("couch", "tv", "remote"))
        assert scene.label == "salon / salle de séjour"
        assert scene.indoor is True

    def test_scenario_rue_complexe(self):
        """Vérifie la détection d'une rue avec circulation et personnes."""
        scene = infer_scene(_objs("car", "bus", "truck", "traffic light", "person"))
        assert scene.label == "rue / circulation urbaine"

    def test_scenario_bureau_avec_personne(self):
        """Vérifie la priorité bureau sur personne seule."""
        scene = infer_scene(_objs("laptop", "keyboard", "mouse", "person"))
        assert scene.label == "bureau / espace de travail"

    def test_scenario_repas(self):
        """Vérifie la détection d'un contexte repas."""
        scene = infer_scene(_objs("dining table", "fork", "knife", "wine glass", "pizza"))
        assert scene.label == "repas / table à manger"

    def test_scenario_safari(self):
        """Vérifie la détection d'un safari avec plusieurs animaux sauvages."""
        scene = infer_scene(_objs("elephant", "zebra", "giraffe"))
        assert scene.label == "zoo / safari"

    def test_scenario_sport_ski(self):
        """Vérifie la détection d'un domaine skiable."""
        scene = infer_scene(_objs("skis", "snowboard", "person"))
        assert scene.label == "domaine skiable / montagne enneigée"

    def test_scenario_foule_exactement_5(self):
        """Vérifie la détection d'une foule avec exactement 5 personnes."""
        scene = infer_scene(_objs("person", "person", "person", "person", "person"))
        assert scene.label == "foule / espace public"

    def test_scenario_groupe_2_personnes(self):
        """Vérifie la détection d'un groupe avec 2 personnes."""
        scene = infer_scene(_objs("person", "person"))
        assert scene.label == "scène de groupe"

    def test_scenario_interieur_generique(self):
        """Vérifie la détection d'un intérieur générique avec une chaise et une plante."""
        scene = infer_scene(_objs("chair", "potted plant", "clock"))
        assert scene.label == "intérieur / pièce de vie"
        assert scene.indoor is True

    def test_confidence_entre_0_et_1(self):
        """Vérifie que la confiance de la scène est toujours entre 0 et 1."""
        scene = infer_scene(_objs("car", "person", "laptop"))
        assert 0.0 <= scene.confidence <= 1.0
