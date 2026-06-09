"""Utilitaires de manipulation d'images pour le service dyper-ai."""

import base64
import binascii
from collections import Counter
from io import BytesIO

from PIL import Image, UnidentifiedImageError


def decode_base64(b64: str) -> Image.Image:
    """Décode une chaîne base64 en image PIL au format RGB.

    Accepte également les data URLs (`data:image/png;base64,...`).
    Lève `ValueError` si la chaîne n'est pas un base64 valide ou si le contenu décodé
    n'est pas une image lisible — l'appelant peut ainsi répondre 422 plutôt que 500.
    """
    payload = b64.strip()
    if payload.lower().startswith("data:") and "," in payload:
        payload = payload.split(",", 1)[1]

    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Chaîne base64 invalide.") from exc

    try:
        return Image.open(BytesIO(raw)).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Le contenu décodé n'est pas une image valide.") from exc


def resize_for_model(img: Image.Image, max_size: int = 1280) -> Image.Image:
    """Redimensionne l'image en conservant le ratio si sa plus grande dimension dépasse max_size.

    YOLO gère nativement le redimensionnement interne ; ce pré-resize économise de la mémoire.
    """
    w, h = img.size
    if max(w, h) <= max_size:
        return img
    ratio = max_size / max(w, h)
    return img.resize((max(1, int(w * ratio)), max(1, int(h * ratio))), Image.Resampling.LANCZOS)


def get_dominant_colors(img: Image.Image, n: int = 3) -> list[str]:
    """Retourne jusqu'à n couleurs dominantes (#RRGGBB), triées par fréquence décroissante.

    L'image est réduite puis quantifiée (median cut). La fréquence réelle de chaque couleur
    de la palette est comptée afin de trier correctement par dominance. Si l'image contient
    moins de n couleurs distinctes, la dernière couleur est répétée pour garantir n entrées.
    """
    if n <= 0:
        return []

    small = img.convert("RGB").resize((150, 150))
    quantized = small.quantize(colors=max(1, n), method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette() or []

    # Comptage de la fréquence de chaque index de palette dans l'image quantifiée.
    frequencies = Counter(quantized.getdata())

    colors: list[str] = []
    for idx, _count in frequencies.most_common(n):
        base = idx * 3
        if base + 2 < len(palette):
            r, g, b = palette[base], palette[base + 1], palette[base + 2]
            colors.append(f"#{r:02X}{g:02X}{b:02X}")

    if not colors:
        return ["#000000"] * n
    # Complète jusqu'à n entrées si moins de couleurs distinctes que demandé.
    while len(colors) < n:
        colors.append(colors[-1])
    return colors[:n]
