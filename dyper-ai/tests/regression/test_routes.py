"""Tests de régression des routes HTTP du service dyper-ai via TestClient."""

import base64
from io import BytesIO

import pytest
from PIL import Image
from unittest.mock import MagicMock, patch


def _blank_image_b64() -> str:
    """Génère une image blanche 100x100 encodée en base64."""
    img = Image.new("RGB", (100, 100), "white")
    buffer = BytesIO()
    img.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


INTERNAL_KEY = "test-key"


@pytest.fixture
def test_client(mock_runner):
    """Retourne un TestClient avec authentification et runner mocké injectés."""
    with patch("app.config.settings") as mock_settings:
        mock_settings.AI_INTERNAL_KEY = INTERNAL_KEY
        mock_settings.YOLO_MODEL_VARIANT = "yolo26l"
        mock_settings.YOLO_CONF_THRESHOLD = 0.25

        from fastapi.testclient import TestClient
        from app.main import app
        app.state.runner = mock_runner

        with TestClient(app, raise_server_exceptions=False) as client:
            yield client


@pytest.mark.regression
class TestRouteHealth:
    """Tests de la route GET /health."""

    def test_health_retourne_200(self):
        """Vérifie que /health retourne un statut 200."""
        with patch("app.routes.health.settings") as mock_settings:
            mock_settings.YOLO_MODEL_VARIANT = "yolo26l"
            from fastapi.testclient import TestClient
            from app.main import app
            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.get("/health")
        assert response.status_code == 200

    def test_health_retourne_status_ok(self):
        """Vérifie que /health retourne {"status": "ok"}."""
        with patch("app.routes.health.settings") as mock_settings:
            mock_settings.YOLO_MODEL_VARIANT = "yolo26l"
            from fastapi.testclient import TestClient
            from app.main import app
            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.get("/health")
        assert response.json()["status"] == "ok"


@pytest.mark.regression
class TestRouteProcess:
    """Tests de la route POST /process."""

    def test_process_sans_cle_retourne_422_ou_401(self, mock_runner):
        """Vérifie que /process sans clé d'authentification retourne une erreur."""
        from fastapi.testclient import TestClient
        from app.main import app
        app.state.runner = mock_runner
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.post(
                "/process",
                json={
                    "requestId": "test-1",
                    "type": "image",
                    "imageBase64": _blank_image_b64(),
                    "lang": "fr",
                },
            )
        assert response.status_code in (401, 422)

    def test_process_prompt_avec_cle_valide(self, mock_runner):
        """Vérifie que /process de type prompt retourne une réponse valide avec clé correcte."""
        with patch("app.utils.auth.settings") as mock_auth_settings, \
             patch("app.routes.health.settings") as mock_health_settings:
            mock_auth_settings.AI_INTERNAL_KEY = INTERNAL_KEY
            mock_health_settings.YOLO_MODEL_VARIANT = "yolo26l"

            from fastapi.testclient import TestClient
            from app.main import app
            app.state.runner = mock_runner

            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.post(
                    "/process",
                    json={
                        "requestId": "test-prompt-1",
                        "type": "prompt",
                        "prompt": "Que vois-tu ?",
                        "lang": "fr",
                    },
                    headers={"X-Internal-Key": INTERNAL_KEY},
                )
        assert response.status_code == 200
        data = response.json()
        assert data["requestId"] == "test-prompt-1"
        assert "description" in data
        assert "visualization" in data

    def test_process_image_retourne_structure_complete(self, mock_runner):
        """Vérifie que /process de type image retourne tous les champs attendus."""
        with patch("app.utils.auth.settings") as mock_auth_settings:
            mock_auth_settings.AI_INTERNAL_KEY = INTERNAL_KEY

            from fastapi.testclient import TestClient
            from app.main import app
            app.state.runner = mock_runner

            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.post(
                    "/process",
                    json={
                        "requestId": "test-img-1",
                        "type": "image",
                        "imageBase64": _blank_image_b64(),
                        "lang": "fr",
                    },
                    headers={"X-Internal-Key": INTERNAL_KEY},
                )
        assert response.status_code == 200
        data = response.json()
        assert "requestId" in data
        assert "description" in data
        assert "visualization" in data
        assert "model" in data
        assert "processingTimeMs" in data
        assert "objects" in data["visualization"]
        assert "scene" in data["visualization"]
        assert "colors" in data["visualization"]
