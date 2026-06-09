"""Fixtures pytest globales pour les tests unitaires et de régression de dyper-ai."""

import os

# La clé interne est requise par la config (fail-fast). On fixe une valeur de test
# AVANT tout import de `app.*` afin que `Settings()` ne lève pas au chargement.
os.environ.setdefault("AI_INTERNAL_KEY", "test-internal-key")

from unittest.mock import MagicMock, patch  # noqa: E402

import pytest  # noqa: E402
from app.schemas.response import BoundingBox, DetectedObject  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

INTERNAL_KEY = os.environ["AI_INTERNAL_KEY"]


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


def _build_mock_runner() -> MagicMock:
    """Construit un mock de YoloRunner simulant une détection « person »."""
    runner = MagicMock()
    runner.model_name = "yolo26l"
    runner.model = object()  # marque le modèle comme « chargé » pour /health.

    mock_results = MagicMock()
    mock_boxes = MagicMock()
    mock_boxes.__len__.return_value = 1
    mock_boxes.xyxy.tolist.return_value = [[10.0, 20.0, 60.0, 120.0]]
    mock_boxes.conf.tolist.return_value = [0.92]
    mock_boxes.cls.tolist.return_value = [0]
    mock_results.boxes = mock_boxes
    mock_results.names = {0: "person"}
    runner.predict.return_value = mock_results
    return runner


@pytest.fixture
def mock_runner() -> MagicMock:
    """Retourne un mock de YoloRunner avec une prédiction YOLO simulée."""
    return _build_mock_runner()


@pytest.fixture
def client(mock_runner):
    """TestClient FastAPI : modèle YOLO mocké (aucun .pt chargé) et authentification désactivée."""
    from app.main import app
    from app.utils.auth import verify_internal_key

    # Patch du runner pour que le lifespan ne charge pas de vrai modèle.
    with patch("app.main.YoloRunner", return_value=mock_runner):
        app.dependency_overrides[verify_internal_key] = lambda: None
        with TestClient(app) as test_client:
            yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def client_auth(mock_runner):
    """TestClient avec modèle mocké mais authentification réelle active (clé = INTERNAL_KEY)."""
    from app.main import app

    with patch("app.main.YoloRunner", return_value=mock_runner):
        with TestClient(app) as test_client:
            yield test_client
