"""Tests unitaires du tracker multi-objets sur mesure (association mouvement / position / label)."""

import pytest
from app.schemas.response import BoundingBox, DetectedObject
from app.services.tracker import ObjectTracker
from PIL import Image


def _img(size: int = 200) -> Image.Image:
    """Image RGB unie (l'apparence n'interfère pas : couleur identique partout)."""
    return Image.new("RGB", (size, size), (120, 120, 120))


def _obj(
    label: str, x: float, y: float, w: float = 20.0, h: float = 20.0, conf: float = 0.9
) -> DetectedObject:
    """Détection avec boîte (coin supérieur gauche x, y)."""
    return DetectedObject(label=label, confidence=conf, boundingBox=BoundingBox(x=x, y=y, w=w, h=h))


@pytest.mark.unit
class TestObjectTracker:
    """Tests de ObjectTracker.update."""

    def test_objet_immobile_garde_son_id(self):
        """Vérifie qu'un objet à la même position garde le même identifiant entre frames."""
        tracker = ObjectTracker()
        img = _img()
        id0 = tracker.update([_obj("car", 50, 50)], img)[0].trackId
        id1 = tracker.update([_obj("car", 50, 50)], img)[0].trackId
        assert id0 == 1
        assert id1 == id0

    def test_deux_objets_ids_distincts_et_stables(self):
        """Vérifie que deux objets reçoivent des identifiants distincts et stables."""
        tracker = ObjectTracker()
        img = _img()
        frame0 = tracker.update([_obj("car", 20, 20), _obj("person", 150, 150)], img)
        frame1 = tracker.update([_obj("car", 22, 21), _obj("person", 151, 149)], img)
        ids0 = [obj.trackId for obj in frame0]
        ids1 = [obj.trackId for obj in frame1]
        assert ids0[0] != ids0[1]
        assert ids1 == ids0  # Mêmes pistes conservées d'une frame à l'autre.

    def test_objet_en_mouvement_garde_son_id(self):
        """Vérifie qu'un objet en translation régulière conserve son ID (prédiction de vitesse)."""
        tracker = ObjectTracker()
        img = _img()
        ids = [tracker.update([_obj("car", x, 40)], img)[0].trackId for x in (20, 32, 44, 56)]
        assert len(set(ids)) == 1  # Une seule identité sur toute la trajectoire.

    def test_saut_lointain_cree_une_nouvelle_piste(self):
        """Vérifie qu'un objet qui « saute » trop loin (au-delà du plafond) reçoit un nouvel ID."""
        tracker = ObjectTracker()
        img = _img()
        id0 = tracker.update([_obj("car", 10, 100)], img)[0].trackId
        id1 = tracker.update([_obj("car", 190, 100)], img)[0].trackId  # Bond à l'autre bout.
        assert id1 != id0

    def test_objet_sans_boite_trackid_none(self):
        """Vérifie qu'une détection sans boîte n'est pas suivie (trackId reste nul)."""
        tracker = ObjectTracker()
        result = tracker.update([DetectedObject(label="musique", confidence=0.8)], _img())
        assert result[0].trackId is None

    def test_piste_oubliee_apres_max_age(self, monkeypatch):
        """Vérifie qu'une piste absente plus de TRACK_MAX_AGE frames est oubliée (nouvel ID au retour)."""
        from app.services import tracker as tracker_module

        monkeypatch.setattr(tracker_module.settings, "TRACK_MAX_AGE", 2)
        tracker = ObjectTracker()
        img = _img()
        id0 = tracker.update([_obj("car", 50, 50)], img)[0].trackId
        for _ in range(3):  # 3 frames vides > max_age (2) → piste oubliée.
            tracker.update([], img)
        id_back = tracker.update([_obj("car", 50, 50)], img)[0].trackId
        assert id_back != id0

    def test_piste_maintenue_pendant_trou_court(self, monkeypatch):
        """Vérifie qu'une piste survit à un trou court (≤ max_age) et garde son ID au retour."""
        from app.services import tracker as tracker_module

        monkeypatch.setattr(tracker_module.settings, "TRACK_MAX_AGE", 3)
        tracker = ObjectTracker()
        img = _img()
        id0 = tracker.update([_obj("car", 50, 50)], img)[0].trackId
        tracker.update([], img)  # Une frame manquée.
        id_back = tracker.update([_obj("car", 52, 50)], img)[0].trackId
        assert id_back == id0
