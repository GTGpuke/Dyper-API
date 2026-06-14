"""Tests unitaires du service de modération de contenu (Groq, best-effort)."""

import base64
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.services import moderation
from app.services.moderation import _parse_rating, classify_image, moderate_text
from PIL import Image


def _image_b64() -> str:
    """Encode une image JPEG factice en base64 (entrée valide pour decode_base64)."""
    buffer = BytesIO()
    Image.new("RGB", (32, 24), "blue").save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _client_returning(content: str) -> MagicMock:
    """Construit un faux client Groq dont la complétion renvoie `content`."""
    completion = MagicMock()
    completion.choices = [MagicMock(message=MagicMock(content=content))]
    client = MagicMock()
    client.chat.completions.create = AsyncMock(return_value=completion)
    return client


@pytest.mark.unit
class TestParseRating:
    """Tests du parsing tolérant de la classification renvoyée par le modèle."""

    def test_mot_unique(self):
        """Vérifie le cas nominal : un seul mot conforme."""
        assert _parse_rating("EXPLICIT", ("safe", "suggestive", "explicit")) == "explicit"

    def test_reponse_verbeuse(self):
        """Vérifie l'extraction quand le modèle ajoute du texte autour du label."""
        assert _parse_rating("This image is SUGGESTIVE.", ("safe", "suggestive", "explicit")) == (
            "suggestive"
        )

    def test_hors_vocabulaire_retourne_none(self):
        """Vérifie qu'un label hors du vocabulaire attendu donne None."""
        # « toxic » n'appartient pas au vocabulaire image.
        assert _parse_rating("TOXIC", ("safe", "suggestive", "explicit")) is None

    def test_indetermine_retourne_none(self):
        """Vérifie qu'une réponse inintelligible donne None."""
        assert _parse_rating("Je ne peux pas vous aider.", ("safe", "toxic", "explicit")) is None
        assert _parse_rating("", ("safe", "toxic", "explicit")) is None


@pytest.mark.unit
class TestClassifyImage:
    """Tests de la classification d'images (NSFW)."""

    async def test_explicite(self):
        """Vérifie qu'une réponse EXPLICIT est classée « explicit »."""
        client = _client_returning("EXPLICIT")
        with (
            patch.object(moderation.settings, "GROQ_API_KEY", "test-key"),
            patch.object(moderation, "_get_client", return_value=client),
        ):
            assert await classify_image(_image_b64()) == "explicit"
        # L'image est bien envoyée en data URL base64.
        sent = client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
        assert sent[1]["image_url"]["url"].startswith("data:image/jpeg;base64,")

    async def test_sur(self):
        """Vérifie qu'une réponse SAFE est classée « safe »."""
        client = _client_returning("SAFE")
        with (
            patch.object(moderation.settings, "GROQ_API_KEY", "test-key"),
            patch.object(moderation, "_get_client", return_value=client),
        ):
            assert await classify_image(_image_b64()) == "safe"

    async def test_sans_cle_retourne_none(self):
        """Vérifie la désactivation sans clé Groq (fail-closed côté passerelle)."""
        with patch.object(moderation.settings, "GROQ_API_KEY", ""):
            assert moderation.is_available() is False
            assert await classify_image(_image_b64()) is None

    async def test_base64_invalide_retourne_none(self):
        """Vérifie qu'une image illisible donne None (sans lever)."""
        with patch.object(moderation.settings, "GROQ_API_KEY", "test-key"):
            assert await classify_image("pas-du-base64-valide") is None


@pytest.mark.unit
class TestModerateText:
    """Tests de la modération de commentaires."""

    async def test_toxique(self):
        """Vérifie qu'une réponse TOXIC est classée « toxic »."""
        client = _client_returning("TOXIC")
        with (
            patch.object(moderation.settings, "GROQ_API_KEY", "test-key"),
            patch.object(moderation, "_get_client", return_value=client),
        ):
            assert await moderate_text("contenu haineux") == "toxic"

    async def test_sur(self):
        """Vérifie qu'une réponse SAFE est classée « safe »."""
        client = _client_returning("SAFE")
        with (
            patch.object(moderation.settings, "GROQ_API_KEY", "test-key"),
            patch.object(moderation, "_get_client", return_value=client),
        ):
            assert await moderate_text("Superbe analyse, merci !") == "safe"

    async def test_sans_cle_retourne_none(self):
        """Vérifie la désactivation sans clé Groq."""
        with patch.object(moderation.settings, "GROQ_API_KEY", ""):
            assert await moderate_text("peu importe") is None
