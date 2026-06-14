"""Tests unitaires de la fusion COCO + vocabulaire ouvert (IoU et déduplication spatiale)."""

import pytest
from app.schemas.response import BoundingBox, DetectedObject
from app.services.fusion import iou, merge_detections


def _obj(label: str, x: float, y: float, w: float, h: float, conf: float = 0.9) -> DetectedObject:
    """Construit un objet détecté avec une boîte (raccourci de test)."""
    return DetectedObject(label=label, confidence=conf, boundingBox=BoundingBox(x=x, y=y, w=w, h=h))


@pytest.mark.unit
class TestIou:
    """Tests de la fonction d'intersection sur union."""

    def test_boites_identiques_donne_un(self):
        """Vérifie que deux boîtes identiques ont une IoU de 1."""
        box = BoundingBox(x=10.0, y=10.0, w=20.0, h=20.0)
        assert iou(box, box) == pytest.approx(1.0)

    def test_boites_disjointes_donne_zero(self):
        """Vérifie que deux boîtes sans recouvrement ont une IoU nulle."""
        a = BoundingBox(x=0.0, y=0.0, w=10.0, h=10.0)
        b = BoundingBox(x=100.0, y=100.0, w=10.0, h=10.0)
        assert iou(a, b) == 0.0

    def test_boites_adjacentes_donne_zero(self):
        """Vérifie que deux boîtes qui se touchent par un bord ont une IoU nulle (aire nulle)."""
        a = BoundingBox(x=0.0, y=0.0, w=10.0, h=10.0)
        b = BoundingBox(x=10.0, y=0.0, w=10.0, h=10.0)
        assert iou(a, b) == 0.0

    def test_recouvrement_partiel_valeur_connue(self):
        """Vérifie l'IoU d'un recouvrement partiel (25 / 175)."""
        a = BoundingBox(x=0.0, y=0.0, w=10.0, h=10.0)
        b = BoundingBox(x=5.0, y=5.0, w=10.0, h=10.0)
        assert iou(a, b) == pytest.approx(25.0 / 175.0)


@pytest.mark.unit
class TestMergeDetections:
    """Tests de la fusion de deux jeux de détections (primaire prioritaire)."""

    def test_boites_disjointes_conserve_les_deux(self):
        """Vérifie que deux détections sans recouvrement sont toutes deux conservées."""
        primary = [_obj("person", 0, 0, 10, 10)]
        secondary = [_obj("car", 100, 100, 10, 10)]
        merged = merge_detections(primary, secondary, 0.55)
        assert [o.label for o in merged] == ["person", "car"]

    def test_recouvrement_garde_primaire_rejette_secondaire(self):
        """Vérifie qu'une boîte secondaire recouvrante (IoU ≥ seuil) est rejetée."""
        primary = [_obj("person", 0, 0, 10, 10)]
        secondary = [_obj("man", 1, 1, 10, 10)]  # IoU ≈ 0,68 avec la primaire.
        merged = merge_detections(primary, secondary, 0.55)
        assert [o.label for o in merged] == ["person"]

    def test_deduplication_spatiale_et_non_par_label(self):
        """Vérifie que la déduplication est spatiale : même boîte, labels différents → une seule.

        COCO « person » et World « man » désignent le même objet ; seule la primaire est gardée.
        """
        primary = [_obj("person", 10, 10, 50, 100)]
        secondary = [_obj("man", 10, 10, 50, 100)]  # Boîte identique, label différent.
        merged = merge_detections(primary, secondary, 0.55)
        assert len(merged) == 1
        assert merged[0].label == "person"

    def test_secondaire_sans_boite_toujours_ajoutee(self):
        """Vérifie qu'une détection secondaire sans boîte (ex. concept global) est conservée."""
        primary = [_obj("person", 0, 0, 10, 10)]
        secondary = [DetectedObject(label="musique", confidence=0.5, boundingBox=None)]
        merged = merge_detections(primary, secondary, 0.55)
        assert [o.label for o in merged] == ["person", "musique"]

    def test_primaire_conservee_en_tete_et_dans_l_ordre(self):
        """Vérifie que toutes les primaires sont gardées en tête, secondaires non recouvrantes après."""
        primary = [_obj("person", 0, 0, 10, 10), _obj("dog", 50, 50, 10, 10)]
        secondary = [
            _obj("man", 1, 1, 10, 10),  # Recouvre « person » → rejetée.
            _obj("tree", 200, 200, 10, 10),  # Disjointe → ajoutée.
        ]
        merged = merge_detections(primary, secondary, 0.55)
        assert [o.label for o in merged] == ["person", "dog", "tree"]

    def test_primaire_vide_garde_toutes_les_secondaires(self):
        """Vérifie que sans détection primaire, toutes les secondaires sont conservées."""
        secondary = [_obj("man", 0, 0, 10, 10), _obj("tree", 100, 100, 10, 10)]
        merged = merge_detections([], secondary, 0.55)
        assert [o.label for o in merged] == ["man", "tree"]

    def test_secondaire_vide_garde_la_primaire(self):
        """Vérifie que sans détection secondaire, la primaire est retournée telle quelle."""
        primary = [_obj("person", 0, 0, 10, 10)]
        merged = merge_detections(primary, [], 0.55)
        assert [o.label for o in merged] == ["person"]
