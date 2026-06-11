"""Fixtures pytest globales pour les tests unitaires et de régression de dyper-ai."""

import os

# La clé interne est requise par la config (fail-fast). On fixe une valeur de test
# AVANT tout import de `app.*` afin que `Settings()` ne lève pas au chargement.
os.environ.setdefault("AI_INTERNAL_KEY", "test-internal-key")
# Les clés externes sont neutralisées (priorité sur le .env) : les tests ne doivent
# jamais appeler les APIs réelles (Groq, AudD), même si le .env local les renseigne.
os.environ["GROQ_API_KEY"] = ""
os.environ["AUDD_API_TOKEN"] = ""

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


def _build_mock_results(track_id: int | None = None, label: str = "person") -> MagicMock:
    """Construit de faux résultats YOLO (une détection, label et piste configurables)."""
    mock_results = MagicMock()
    mock_boxes = MagicMock()
    mock_boxes.__len__.return_value = 1
    mock_boxes.xyxy.tolist.return_value = [[10.0, 20.0, 60.0, 120.0]]
    mock_boxes.conf.tolist.return_value = [0.92]
    mock_boxes.cls.tolist.return_value = [0]
    if track_id is None:
        # Mode prédiction simple : pas d'identifiants de piste.
        mock_boxes.id = None
    else:
        mock_boxes.id.tolist.return_value = [track_id]
    mock_results.boxes = mock_boxes
    mock_results.names = {0: label}
    return mock_results


def _build_mock_runner() -> MagicMock:
    """Construit un mock de YoloRunner simulant une détection « person » (predict et track)."""
    runner = MagicMock()
    runner.model_name = "yolo26l"
    runner.model = object()  # marque le modèle comme « chargé » pour /health.
    runner.predict.return_value = _build_mock_results()
    runner.track.return_value = _build_mock_results(track_id=1)
    return runner


def _build_mock_world() -> MagicMock:
    """Construit un mock de WorldRunner : détecte le premier élément du vocabulaire demandé."""
    world = MagicMock()
    world.model_name = "yolov8x-worldv2"
    world.is_ready.return_value = True
    world.detect_classes.side_effect = lambda image, classes, persist=None: _build_mock_results(
        track_id=1 if persist is not None else None,
        label=classes[0] if classes else "thing",
    )
    return world


@pytest.fixture
def mock_runner() -> MagicMock:
    """Retourne un mock de YoloRunner avec une prédiction YOLO simulée."""
    return _build_mock_runner()


@pytest.fixture
def mock_world() -> MagicMock:
    """Retourne un mock de WorldRunner (détection à vocabulaire ouvert simulée)."""
    return _build_mock_world()


@pytest.fixture
def client(mock_runner, mock_world):
    """TestClient FastAPI : modèles mockés (aucun .pt chargé) et authentification désactivée."""
    from app.main import app
    from app.utils.auth import verify_internal_key

    # Patch des runners pour que le lifespan ne charge (ni télécharge) aucun vrai modèle.
    with (
        patch("app.main.YoloRunner", return_value=mock_runner),
        patch("app.main.WorldRunner", return_value=mock_world),
    ):
        app.dependency_overrides[verify_internal_key] = lambda: None
        with TestClient(app) as test_client:
            yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def client_auth(mock_runner, mock_world):
    """TestClient avec modèles mockés mais authentification réelle active (clé = INTERNAL_KEY)."""
    from app.main import app

    with (
        patch("app.main.YoloRunner", return_value=mock_runner),
        patch("app.main.WorldRunner", return_value=mock_world),
    ):
        with TestClient(app) as test_client:
            yield test_client
