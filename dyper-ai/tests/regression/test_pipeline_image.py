"""Tests de régression du pipeline de détection d'image avec runner YOLO mocké."""

import pytest
from PIL import Image
from unittest.mock import MagicMock

from app.schemas.response import ProcessResponse
from app.services.detector import detect


@pytest.mark.regression
class TestPipelineImage:
    """Tests du pipeline complet detect() avec un runner mocké."""

    def test_detect_retourne_process_response(self, mock_runner, blank_image):
        """Vérifie que detect() retourne bien une instance ProcessResponse."""
        result = detect(blank_image, mock_runner, None, "fr", "req-001", 50)
        assert isinstance(result, ProcessResponse)

    def test_detect_request_id_preserve(self, mock_runner, blank_image):
        """Vérifie que le requestId est conservé dans la réponse."""
        result = detect(blank_image, mock_runner, None, "fr", "req-abc", 50)
        assert result.requestId == "req-abc"

    def test_detect_model_name_dans_reponse(self, mock_runner, blank_image):
        """Vérifie que le nom du modèle est correct dans la réponse."""
        result = detect(blank_image, mock_runner, None, "fr", "req-001", 50)
        assert result.model == "yolo26l"

    def test_detect_avec_objets_detectes(self, mock_runner, blank_image):
        """Vérifie que les objets détectés sont correctement extraits des résultats YOLO."""
        result = detect(blank_image, mock_runner, None, "fr", "req-001", 50)
        assert len(result.visualization.objects) == 1
        assert result.visualization.objects[0].label == "person"

    def test_detect_couleurs_dominantes(self, mock_runner, blank_image):
        """Vérifie que 3 couleurs dominantes sont extraites."""
        result = detect(blank_image, mock_runner, None, "fr", "req-001", 50)
        assert len(result.visualization.colors) == 3

    def test_detect_tags_non_vides(self, mock_runner, blank_image):
        """Vérifie que les tags sont non vides quand des objets sont détectés."""
        result = detect(blank_image, mock_runner, None, "fr", "req-001", 50)
        assert "person" in result.visualization.tags

    def test_detect_description_non_vide(self, mock_runner, blank_image):
        """Vérifie que la description générée est non vide."""
        result = detect(blank_image, mock_runner, None, "fr", "req-001", 50)
        assert len(result.description) > 0

    def test_detect_avec_prompt(self, mock_runner, blank_image):
        """Vérifie que le prompt est intégré dans la description."""
        result = detect(blank_image, mock_runner, "Que vois-tu ?", "fr", "req-001", 50)
        assert "Que vois-tu ?" in result.description

    def test_detect_sans_boites(self, blank_image):
        """Vérifie que detect() gère correctement un résultat YOLO sans boîtes."""
        runner = MagicMock()
        runner.model_name = "yolo26l"
        mock_results = MagicMock()
        mock_results.boxes = None
        runner.predict.return_value = mock_results

        result = detect(blank_image, runner, None, "fr", "req-002", 50)
        assert isinstance(result, ProcessResponse)
        assert result.visualization.objects == []
