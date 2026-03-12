"""Fixtures pytest globales pour les tests unitaires et de régression de dyper-ai."""

import pytest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from PIL import Image

from app.schemas.response import BoundingBox, DetectedObject


@pytest.fixture
def blank_image() -> Image.Image:
    """Retourne une image blanche 100x100 pixels pour les tests."""
    return Image.new("RGB", (100, 100), "white")


@pytest.fixture
def sample_objects() -> list:
    """Retourne une liste d'objets détectés factices pour les tests."""
    return [
        DetectedObject(
            label="person",
            confidence=0.92,
            boundingBox=BoundingBox(x=10.0, y=20.0, w=50.0, h=100.0),
        ),
        DetectedObject(
            label="car",
            confidence=0.85,
            boundingBox=BoundingBox(x=200.0, y=150.0, w=80.0, h=40.0),
        ),
    ]


@pytest.fixture
def mock_runner():
    """Retourne un mock de YoloRunner avec une prédiction YOLO simulée."""
    runner = MagicMock()
    runner.model_name = "yolo26l"

    # Simulation des résultats YOLO bruts.
    mock_results = MagicMock()
    mock_boxes = MagicMock()
    mock_boxes.xyxy.tolist.return_value = [[10.0, 20.0, 60.0, 120.0]]
    mock_boxes.conf.tolist.return_value = [0.92]
    mock_boxes.cls.tolist.return_value = [0]
    mock_results.boxes = mock_boxes
    mock_results.names = {0: "person"}

    runner.predict.return_value = mock_results
    return runner


@pytest.fixture
def client(mock_runner):
    """Retourne un TestClient FastAPI avec le runner YOLO mocké injecté dans app.state."""
    with patch("app.routes.process.verify_internal_key", return_value=None):
        from app.main import app
        app.state.runner = mock_runner
        with TestClient(app, raise_server_exceptions=True) as test_client:
            yield test_client
