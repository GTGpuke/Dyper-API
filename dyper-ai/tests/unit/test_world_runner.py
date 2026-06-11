"""Tests unitaires du détecteur à vocabulaire ouvert (WorldRunner, modèle mocké)."""

from unittest.mock import MagicMock

import pytest
import torch
from app.services.world_runner import WorldRunner


def _runner_with_mock_model(clip_device: str = "cpu") -> tuple[WorldRunner, MagicMock]:
    """Construit un WorldRunner dont le modèle ultralytics est entièrement mocké."""
    runner = WorldRunner()
    model = MagicMock()
    # Wrapper CLIP en cache : poids sur `clip_device`, attribut device volontairement périmé.
    # Un itérateur FRAIS à chaque appel (next() épuiserait un return_value unique).
    clip_wrapper = MagicMock()
    weights = torch.zeros(1, device=clip_device)
    clip_wrapper.model.parameters.side_effect = lambda: iter([weights])
    clip_wrapper.device = "périmé"
    model.model.clip_model = clip_wrapper
    model.predict.return_value = ["résultats"]
    model.track.return_value = ["résultats"]
    runner.model = model
    return runner, model


@pytest.mark.unit
class TestWorldRunner:
    """Tests du vocabulaire dynamique et de la synchronisation de device."""

    def test_non_charge_leve_erreur(self):
        """Vérifie le message explicite si le modèle n'est pas chargé."""
        with pytest.raises(RuntimeError, match="n'est pas chargé"):
            WorldRunner().detect_classes(MagicMock(), ["person"])

    def test_vocabulaire_encode_une_seule_fois(self):
        """Vérifie le cache : un vocabulaire identique n'est pas réencodé (CLIP coûteux)."""
        runner, model = _runner_with_mock_model()
        runner.detect_classes(MagicMock(), ["person", "rock"])
        runner.detect_classes(MagicMock(), ["person", "rock"])
        assert model.set_classes.call_count == 1
        # Un vocabulaire différent déclenche un nouvel encodage.
        runner.detect_classes(MagicMock(), ["elephant"])
        assert model.set_classes.call_count == 2

    def test_synchronisation_device_clip(self):
        """Vérifie que le device du wrapper CLIP est réaligné sur ses poids avant set_classes.

        Régression du bug « index is on cpu, different from other tensors on cuda:0 » :
        après le passage du modèle sur GPU, le wrapper CLIP gardait un device périmé.
        """
        runner, model = _runner_with_mock_model(clip_device="cpu")
        runner.detect_classes(MagicMock(), ["person"])
        assert str(model.model.clip_model.device) == "cpu"

    def test_predict_sans_persist_track_avec(self):
        """Vérifie l'aiguillage : persist=None → predict, persist fourni → track."""
        runner, model = _runner_with_mock_model()
        runner.detect_classes(MagicMock(), ["person"])
        model.predict.assert_called_once()
        model.track.assert_not_called()

        runner.detect_classes(MagicMock(), ["person"], persist=False)
        model.track.assert_called_once()
        assert model.track.call_args.kwargs["persist"] is False
