"""Extraction de frames représentatives depuis une vidéo encodée en base64."""

import base64
import binascii
import math
import os
import tempfile

import cv2
from PIL import Image

from app.config import settings

# Cadence de repli si la vidéo n'expose pas de FPS valide (CAP_PROP_FPS <= 0).
_FALLBACK_FPS = 25.0


class VideoTooLongError(Exception):
    """Levée lorsqu'une vidéo dépasse la durée maximale autorisée."""


def extract_frames(video_base64: str) -> list[Image.Image]:
    """Extrait des images réparties uniformément sur TOUTE la durée d'une vidéo base64.

    Le nombre d'images suit la cadence cible (`VIDEO_SAMPLE_FPS`), plafonné par
    `VIDEO_MAX_FRAMES`. Décode la vidéo dans un fichier temporaire, capture des frames à des
    positions distinctes réparties sur toute la durée, puis supprime le fichier.

    Lève `ValueError` si la chaîne base64 est invalide (l'appelant peut répondre 422).
    Lève `VideoTooLongError` si la durée dépasse `VIDEO_MAX_DURATION_S`.
    """
    try:
        video_bytes = base64.b64decode(video_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Vidéo base64 invalide.") from exc

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".mp4")
    frames: list[Image.Image] = []
    cap: cv2.VideoCapture | None = None
    try:
        with os.fdopen(tmp_fd, "wb") as tmp_file:
            tmp_file.write(video_bytes)

        cap = cv2.VideoCapture(tmp_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            return []

        # Durée estimée à partir du FPS (repli si le conteneur n'expose pas de FPS valide).
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = _FALLBACK_FPS
        duration_s = total_frames / fps

        if duration_s > settings.VIDEO_MAX_DURATION_S:
            raise VideoTooLongError("La vidéo dépasse la durée maximale autorisée de 5 minutes.")

        # Nombre d'images = cadence cible sur toute la durée, plafonné, borné au nombre de frames.
        target = math.ceil(duration_s * settings.VIDEO_SAMPLE_FPS)
        n_frames = max(1, min(settings.VIDEO_MAX_FRAMES, target, total_frames))

        # Positions distinctes réparties uniformément, bornées à [0, total_frames - 1].
        if n_frames == 1 or total_frames == 1:
            positions = [0]
        else:
            raw = [round(total_frames * i / (n_frames - 1)) for i in range(n_frames)]
            positions = sorted({min(max(p, 0), total_frames - 1) for p in raw})

        for pos in positions:
            cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
            ret, frame = cap.read()
            if ret:
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frames.append(Image.fromarray(frame_rgb))
    finally:
        if cap is not None:
            cap.release()
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return frames
