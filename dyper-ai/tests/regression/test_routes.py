"""Tests de régression des routes HTTP du service dyper-ai via TestClient (runner mocké)."""

import base64
from io import BytesIO

import pytest
from PIL import Image

from tests.conftest import INTERNAL_KEY


def _blank_image_b64() -> str:
    """Génère une image blanche 100x100 encodée en base64."""
    img = Image.new("RGB", (100, 100), "white")
    buffer = BytesIO()
    img.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


@pytest.mark.regression
class TestRouteHealth:
    """Tests de la route GET /health."""

    def test_health_retourne_200(self, client):
        """Vérifie que /health retourne un statut 200."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_retourne_status_ok(self, client):
        """Vérifie que /health retourne {"status": "ok"} avec le nom du modèle."""
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "ok"
        assert data["model"] == "yolo26l"


@pytest.mark.regression
class TestRouteProcessAuth:
    """Tests d'authentification de la route POST /process (clé interne réelle active)."""

    def test_process_sans_cle_retourne_401(self, client_auth):
        """Vérifie que /process sans header X-Internal-Key retourne 401."""
        response = client_auth.post(
            "/process",
            json={"requestId": "no-key", "type": "prompt", "prompt": "test", "lang": "fr"},
        )
        assert response.status_code == 401

    def test_process_mauvaise_cle_retourne_401(self, client_auth):
        """Vérifie qu'une clé interne incorrecte retourne 401."""
        response = client_auth.post(
            "/process",
            json={"requestId": "bad-key", "type": "prompt", "prompt": "test", "lang": "fr"},
            headers={"X-Internal-Key": "wrong"},
        )
        assert response.status_code == 401

    def test_process_bonne_cle_retourne_200(self, client_auth):
        """Vérifie qu'une clé interne valide est acceptée."""
        response = client_auth.post(
            "/process",
            json={"requestId": "ok-key", "type": "prompt", "prompt": "test", "lang": "fr"},
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        assert response.status_code == 200


@pytest.mark.regression
class TestRouteProcess:
    """Tests fonctionnels de la route POST /process (authentification désactivée)."""

    def test_process_prompt_retourne_reponse_valide(self, client):
        """Vérifie que /process de type prompt retourne une réponse structurée."""
        response = client.post(
            "/process",
            json={
                "requestId": "test-prompt-1",
                "type": "prompt",
                "prompt": "Que vois-tu ?",
                "lang": "fr",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["requestId"] == "test-prompt-1"
        assert "description" in data
        assert "visualization" in data

    def test_process_image_structure_complete(self, client):
        """Vérifie que /process de type image retourne tous les champs attendus."""
        response = client.post(
            "/process",
            json={
                "requestId": "test-img-1",
                "type": "image",
                "imageBase64": _blank_image_b64(),
                "lang": "fr",
            },
        )
        assert response.status_code == 200
        data = response.json()
        for field in ("requestId", "description", "visualization", "model", "processingTimeMs"):
            assert field in data
        viz = data["visualization"]
        for field in ("objects", "scene", "colors", "tags"):
            assert field in viz
        assert viz["objects"][0]["label"] == "person"

    def test_process_image_base64_invalide_retourne_422(self, client):
        """Vérifie qu'un base64 invalide retourne 422 (et non 500)."""
        response = client.post(
            "/process",
            json={
                "requestId": "bad-b64",
                "type": "image",
                "imageBase64": "!!!not-base64!!!",
                "lang": "fr",
            },
        )
        assert response.status_code == 422

    def test_process_image_sans_source_retourne_422(self, client):
        """Vérifie qu'un type image sans imageBase64 ni imageUrl retourne 422 (validation)."""
        response = client.post(
            "/process",
            json={"requestId": "no-src", "type": "image", "lang": "fr"},
        )
        assert response.status_code == 422

    def test_process_image_lang_en(self, client):
        """Vérifie que la description est générée en anglais lorsque lang=en."""
        response = client.post(
            "/process",
            json={
                "requestId": "en-1",
                "type": "image",
                "imageBase64": _blank_image_b64(),
                "lang": "en",
            },
        )
        assert response.status_code == 200
        assert "The image shows" in response.json()["description"]
