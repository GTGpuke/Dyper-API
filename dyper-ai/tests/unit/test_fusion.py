"""Tests unitaires de la fusion COCO + vocabulaire ouvert (IoU et déduplication spatiale)."""

import pytest
from app.schemas.response import BoundingBox, DetectedObject
from app.services.fusion import (
    filter_border_detections,
    iou,
    mark_priority,
    merge_detections,
)


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


@pytest.mark.unit
class TestMarkPriority:
    """Tests du marquage de priorité (plancher de confiance, sans aucune suppression)."""

    def test_marque_selon_le_plancher(self):
        """Vérifie le marquage prioritaire/non selon le seuil, sans suppression de détection."""
        objects = [
            _obj("person", 0, 0, 10, 10, conf=0.9),
            _obj("plante", 50, 50, 10, 10, conf=0.31),
        ]
        marked = mark_priority(objects, 0.51)
        assert len(marked) == 2  # aucune détection retirée
        assert {o.label: o.priority for o in marked} == {"person": True, "plante": False}

    def test_plancher_inclusif(self):
        """Vérifie que le plancher est inclusif (confiance == seuil → prioritaire)."""
        objects = [_obj("car", 0, 0, 10, 10, conf=0.51)]
        assert mark_priority(objects, 0.51)[0].priority is True

    def test_liste_vide(self):
        """Vérifie le cas trivial d'une liste vide."""
        assert mark_priority([], 0.51) == []


@pytest.mark.unit
class TestFilterBorderDetections:
    """Tests du filtre de bordure (objets tronqués par le bord, écartés en vidéo)."""

    def test_marge_nulle_desactive_le_filtre(self):
        """Vérifie qu'une marge ≤ 0 ne retire rien (même une boîte au bord)."""
        objects = [_obj("car", 0, 0, 10, 10)]
        assert len(filter_border_detections(objects, 100, 100, 0.0)) == 1

    def test_retire_les_boites_au_bord(self):
        """Vérifie qu'une boîte touchant un bord (objet tronqué) est écartée, le centre gardé."""
        edge = _obj("truck", 0, 40, 20, 20)  # touche le bord gauche (x = 0).
        center = _obj("car", 40, 40, 20, 20)  # bien à l'intérieur.
        kept = filter_border_detections([edge, center], 100, 100, 0.05)
        assert [o.label for o in kept] == ["car"]

    def test_garde_les_objets_sans_boite(self):
        """Vérifie qu'un objet sans boîte (concept global) est toujours conservé."""
        objects = [DetectedObject(label="musique", confidence=0.5, boundingBox=None)]
        assert len(filter_border_detections(objects, 100, 100, 0.05)) == 1
