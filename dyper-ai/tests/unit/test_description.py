"""Tests unitaires pour la génération de descriptions textuelles."""

import pytest

from app.schemas.response import DetectedObject, Scene
from app.services.description import generate


def _scene(label: str = "scène générale") -> Scene:
    """Crée une scène factice pour les tests."""
    return Scene(label=label, confidence=0.5, indoor=None)


def _obj(label: str, conf: float = 0.9) -> DetectedObject:
    """Crée un objet détecté factice pour les tests."""
    return DetectedObject(label=label, confidence=conf)


@pytest.mark.unit
class TestGenerate:
    """Tests de la fonction generate."""

    def test_sans_objet_sans_prompt_fr(self):
        """Vérifie le message par défaut en français sans objets ni prompt."""
        result = generate([], _scene(), None, "fr")
        assert "Aucun objet" in result
        assert "détecté" in result

    def test_sans_objet_sans_prompt_en(self):
        """Vérifie le message par défaut en anglais sans objets ni prompt."""
        result = generate([], _scene(), None, "en")
        assert "No recognized object" in result

    def test_sans_objet_avec_prompt_fr(self):
        """Vérifie le message en français sans objets mais avec un prompt."""
        result = generate([], _scene(), "Que vois-tu ?", "fr")
        assert "Aucun objet" in result
        assert "Que vois-tu ?" in result

    def test_avec_objets_fr(self):
        """Vérifie que la description en français contient le label traduit et la scène."""
        objects = [_obj("car")]
        result = generate(objects, _scene("rue / circulation urbaine"), None, "fr")
        assert "voiture" in result
        assert "rue / circulation urbaine" in result

    def test_avec_objets_en(self):
        """Vérifie que la description en anglais contient le label brut COCO."""
        objects = [_obj("car")]
        result = generate(objects, _scene("street"), None, "en")
        assert "car" in result

    def test_avec_prompt_fr(self):
        """Vérifie que le prompt est inclus dans la description en français."""
        objects = [_obj("person")]
        result = generate(objects, _scene(), "Qui est là ?", "fr")
        assert "Qui est là ?" in result
        assert "personne" in result

    def test_pluriel_fr(self):
        """Vérifie que le pluriel français est correctement appliqué pour 3 voitures."""
        objects = [_obj("car"), _obj("car"), _obj("car")]
        result = generate(objects, _scene(), None, "fr")
        assert "3 voitures" in result

    def test_singulier_fr(self):
        """Vérifie que le singulier français est correctement appliqué pour 1 voiture."""
        objects = [_obj("car")]
        result = generate(objects, _scene(), None, "fr")
        assert "une voiture" in result

    def test_label_inconnu_fr(self):
        """Vérifie qu'un label inconnu est affiché avec un article générique en français."""
        objects = [_obj("unknown_object")]
        result = generate(objects, _scene(), None, "fr")
        assert "unknown_object" in result
