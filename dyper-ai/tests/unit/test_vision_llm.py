"""Tests unitaires du service de compréhension vision structurée (Groq, best-effort)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.services import vision_llm
from app.services.vision_llm import _build_instructions, _parse_structured, describe_and_extract
from PIL import Image


def _image() -> Image.Image:
    """Crée une image factice pour les tests."""
    return Image.new("RGB", (64, 48), "blue")


@pytest.mark.unit
class TestParsing:
    """Tests du parsing des lignes structurées (ELEMENTS / SCENE / INDOOR)."""

    def test_parsing_complet(self):
        """Vérifie l'extraction des trois lignes et leur retrait du compte rendu."""
        raw = (
            "Un homme se tient devant un enclos d'éléphants, bordé d'un grand rocher.\n"
            "ELEMENTS: Elephant, man, Rock, metal fence, elephant\n"
            "SCENE: enclos de zoo\n"
            "INDOOR: non"
        )
        analysis = _parse_structured(raw)
        assert analysis.description == (
            "Un homme se tient devant un enclos d'éléphants, bordé d'un grand rocher."
        )
        # Minuscules, dédupliqué, ordre préservé.
        assert analysis.elements == ["elephant", "man", "rock", "metal fence"]
        assert analysis.scene_label == "enclos de zoo"
        assert analysis.indoor is False

    def test_lignes_absentes_champs_vides(self):
        """Vérifie le parsing tolérant : sans lignes structurées, champs vides."""
        analysis = _parse_structured("Juste un compte rendu en prose.")
        assert analysis.description == "Juste un compte rendu en prose."
        assert analysis.elements == []
        assert analysis.scene_label is None
        assert analysis.indoor is None

    def test_indoor_inconnu(self):
        """Vérifie que INDOOR inconnu (ou malformé) donne None."""
        assert _parse_structured("x\nINDOOR: inconnu").indoor is None
        assert _parse_structured("x\nINDOOR: peut-être").indoor is None
        assert _parse_structured("x\nINDOOR: oui").indoor is True

    def test_elements_plafonnes(self):
        """Vérifie le plafonnement du nombre d'éléments (WORLD_MAX_CLASSES)."""
        many = ", ".join(f"item{i}" for i in range(40))
        analysis = _parse_structured(f"x\nELEMENTS: {many}")
        assert len(analysis.elements) == vision_llm.settings.WORLD_MAX_CLASSES

    def test_instructions_contiennent_contexte(self):
        """Vérifie que le prompt inclut l'audio, la musique, la langue et les lignes attendues."""
        text = _build_instructions(
            "en", "Que se passe-t-il ?", "Bonjour à tous.", "Daft Punk — Around the World", True
        )
        assert "Bonjour à tous." in text
        assert "Daft Punk — Around the World" in text
        assert "Que se passe-t-il ?" in text
        assert "anglais" in text
        assert "ELEMENTS:" in text
        assert "SCENE:" in text
        assert "INDOOR:" in text


@pytest.mark.unit
class TestDescribeAndExtract:
    """Tests de l'appel vision complet."""

    async def test_indisponible_sans_cle(self):
        """Vérifie le repli None lorsque la clé Groq est absente (défaut des tests)."""
        assert vision_llm.is_available() is False
        assert await describe_and_extract([_image()], "fr", None) is None

    async def test_appel_reussi_retourne_analyse(self):
        """Vérifie qu'un appel réussi retourne l'analyse structurée parsée."""
        completion = MagicMock()
        completion.choices = [
            MagicMock(
                message=MagicMock(
                    content="Un compte rendu riche.\nELEMENTS: rock, fence\nSCENE: zoo\nINDOOR: non"
                )
            )
        ]
        client = MagicMock()
        client.chat.completions.create = AsyncMock(return_value=completion)

        with (
            patch.object(vision_llm.settings, "GROQ_API_KEY", "test-key"),
            patch.object(vision_llm, "_get_client", return_value=client),
        ):
            analysis = await describe_and_extract([_image()], "fr", None)

        assert analysis is not None
        assert analysis.description == "Un compte rendu riche."
        assert analysis.elements == ["rock", "fence"]
        assert analysis.scene_label == "zoo"
        # La requête contient bien le texte d'instructions et une image en data-URL.
        sent = client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
        assert sent[0]["type"] == "text"
        assert sent[1]["image_url"]["url"].startswith("data:image/jpeg;base64,")

    async def test_echec_api_retourne_none(self):
        """Vérifie le repli None lorsque l'API échoue (jamais d'exception propagée)."""
        client = MagicMock()
        client.chat.completions.create = AsyncMock(side_effect=RuntimeError("panne"))

        with (
            patch.object(vision_llm.settings, "GROQ_API_KEY", "test-key"),
            patch.object(vision_llm, "_get_client", return_value=client),
        ):
            assert await describe_and_extract([_image()], "fr", None) is None
