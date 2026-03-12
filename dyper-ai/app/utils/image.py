"""Utilitaires de manipulation d'images pour le service dyper-ai."""

import base64
from io import BytesIO
from typing import List

from PIL import Image


def decode_base64(b64: str) -> Image.Image:
    """Décode une chaîne base64 en image PIL au format RGB."""
    raw = base64.b64decode(b64)
    return Image.open(BytesIO(raw)).convert("RGB")


def resize_for_model(img: Image.Image, max_size: int = 1280) -> Image.Image:
    """Redimensionne l'image en conservant le ratio si la dimension max dépasse max_size."""
    w, h = img.size
    if max(w, h) <= max_size:
        return img
    ratio = max_size / max(w, h)
    return img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)


def get_dominant_colors(img: Image.Image, n: int = 3) -> List[str]:
    """Retourne les n couleurs dominantes en hexadécimal, triées par fréquence décroissante."""
    small = img.convert("RGB").resize((150, 150))
    quantized = small.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette()
    colors = []
    for i in range(n):
        r, g, b = palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2]
        colors.append(f"#{r:02X}{g:02X}{b:02X}")
    return colors
