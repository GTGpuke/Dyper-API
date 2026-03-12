"""Tests unitaires pour les utilitaires de manipulation d'images."""

import base64
from io import BytesIO

import pytest
from PIL import Image

from app.utils.image import decode_base64, get_dominant_colors, resize_for_model


def _make_base64_image(width: int = 100, height: int = 100, color: str = "red") -> str:
    """Crée une image PIL et la encode en base64 pour les tests."""
    img = Image.new("RGB", (width, height), color)
    buffer = BytesIO()
    img.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


@pytest.mark.unit
class TestDecodeBase64:
    """Tests de la fonction decode_base64."""

    def test_decode_retourne_image_pil(self):
        """Vérifie que le décodage retourne bien une instance PIL.Image."""
        b64 = _make_base64_image()
        result = decode_base64(b64)
        assert isinstance(result, Image.Image)

    def test_decode_mode_rgb(self):
        """Vérifie que l'image décodée est en mode RGB."""
        b64 = _make_base64_image()
        result = decode_base64(b64)
        assert result.mode == "RGB"

    def test_decode_dimensions_correctes(self):
        """Vérifie que les dimensions de l'image décodée correspondent à l'original."""
        b64 = _make_base64_image(width=200, height=150)
        result = decode_base64(b64)
        assert result.size == (200, 150)


@pytest.mark.unit
class TestResizeForModel:
    """Tests de la fonction resize_for_model."""

    def test_pas_de_redimensionnement_si_petite(self):
        """Vérifie qu'une petite image n'est pas modifiée."""
        img = Image.new("RGB", (640, 480))
        result = resize_for_model(img, max_size=1280)
        assert result.size == (640, 480)

    def test_redimensionnement_si_trop_grande(self):
        """Vérifie qu'une grande image est réduite à la taille max."""
        img = Image.new("RGB", (2560, 1920))
        result = resize_for_model(img, max_size=1280)
        assert max(result.size) == 1280

    def test_ratio_conserve(self):
        """Vérifie que le ratio largeur/hauteur est conservé après redimensionnement."""
        img = Image.new("RGB", (2000, 1000))
        result = resize_for_model(img, max_size=1000)
        w, h = result.size
        assert abs(w / h - 2.0) < 0.01

    def test_image_carre_redimensionnee(self):
        """Vérifie qu'une image carrée est correctement redimensionnée."""
        img = Image.new("RGB", (2000, 2000))
        result = resize_for_model(img, max_size=1280)
        assert result.size == (1280, 1280)


@pytest.mark.unit
class TestGetDominantColors:
    """Tests de la fonction get_dominant_colors."""

    def test_retourne_n_couleurs(self):
        """Vérifie que le nombre de couleurs retournées correspond à n."""
        img = Image.new("RGB", (100, 100), "blue")
        colors = get_dominant_colors(img, n=3)
        assert len(colors) == 3

    def test_format_hexadecimal(self):
        """Vérifie que chaque couleur est au format hexadécimal #RRGGBB."""
        img = Image.new("RGB", (100, 100), "green")
        colors = get_dominant_colors(img, n=3)
        for color in colors:
            assert color.startswith("#")
            assert len(color) == 7
