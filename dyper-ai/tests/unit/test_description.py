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

    def test_structure_phrase_en(self):
        """Vérifie que la phrase d'ouverture anglaise conserve sa forme historique."""
        objects = [_obj("car")]
        result = generate(objects, _scene("street / urban traffic"), None, "en")
        assert result.startswith("The image shows a car in a context of street / urban traffic.")
        # Le compte rendu se termine par la phrase de fiabilité.
        assert "reliable" in result

    def test_article_an_devant_voyelle_en(self):
        """Vérifie l'usage de « an » devant un label commençant par une voyelle."""
        objects = [_obj("apple")]
        result = generate(objects, _scene("kitchen"), None, "en")
        assert "an apple" in result

    def test_pluriel_en(self):
        """Vérifie le pluriel naïf anglais pour plusieurs objets."""
        objects = [_obj("car"), _obj("car")]
        result = generate(objects, _scene("street"), None, "en")
        assert "2 cars" in result

    def test_prompt_inclus_en(self):
        """Vérifie que le prompt est inclus dans la description anglaise."""
        objects = [_obj("person")]
        result = generate(objects, _scene("group scene"), "Who is there?", "en")
        assert "Who is there?" in result


@pytest.mark.unit
class TestGenerateEnrichi:
    """Tests du compte rendu enrichi (composition, couleurs, intérieur/extérieur, chronologie)."""

    def test_composition_sujet_principal_fr(self):
        """Vérifie la phrase de composition (position + emprise) avec une boîte englobante."""
        from app.schemas.response import BoundingBox

        # Boîte centrée occupant 25 % d'une image 100x100.
        obj = DetectedObject(
            label="car", confidence=0.95, boundingBox=BoundingBox(x=25, y=25, w=50, h=50)
        )
        result = generate([obj], _scene(), None, "fr", image_size=(100, 100))
        assert "sujet principal" in result
        assert "au centre" in result
        assert "25 %" in result

    def test_composition_position_gauche_en(self):
        """Vérifie la latéralisation à gauche en anglais."""
        from app.schemas.response import BoundingBox

        obj = DetectedObject(
            label="dog", confidence=0.9, boundingBox=BoundingBox(x=0, y=40, w=20, h=20)
        )
        result = generate([obj], _scene(), None, "en", image_size=(100, 100))
        assert "on the left side" in result

    def test_couleurs_nommees_fr(self):
        """Vérifie la traduction des couleurs hexadécimales en noms français."""
        result = generate([_obj("car")], _scene(), None, "fr", colors=["#FF0000", "#0000CC"])
        assert "rouge" in result
        assert "bleu" in result

    def test_interieur_fr(self):
        """Vérifie la phrase intérieur/extérieur quand la scène est qualifiée."""
        scene = Scene(label="salon", confidence=0.7, indoor=True)
        result = generate([_obj("couch")], scene, None, "fr")
        assert "en intérieur" in result

    def test_fiabilite_faible_fr(self):
        """Vérifie le qualificatif de fiabilité basse pour une confiance moyenne faible."""
        result = generate([_obj("car", conf=0.3)], _scene(), None, "fr")
        assert "prudence" in result

    def test_chronologie_video_fr(self):
        """Vérifie la durée et les phrases de présence générées depuis la chronologie."""
        from app.schemas.response import TimelineEntry

        timeline = [
            TimelineEntry(t=0.0, labels=["person"]),
            TimelineEntry(t=30.0, labels=["person", "car"]),
            TimelineEntry(t=60.0, labels=["person"]),
        ]
        result = generate([_obj("person"), _obj("car")], _scene(), None, "fr", timeline=timeline)
        assert "La vidéo dure environ 1:00." in result
        assert "tout au long de la vidéo" in result
        # « car » présent sur 1 échantillon sur 3 → apparition ponctuelle avec horodatage.
        assert "ponctuellement" in result
        assert "0:30" in result
