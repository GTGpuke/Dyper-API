"""Extraction de frames représentatives depuis une vidéo encodée en base64."""

import base64
import binascii
import os
import tempfile

import cv2
from PIL import Image


def extract_frames(video_base64: str, n_frames: int = 5) -> list[Image.Image]:
    """Extrait jusqu'à n_frames images réparties uniformément depuis une vidéo base64.

    Décode la vidéo dans un fichier temporaire, capture des frames à des positions distinctes
    réparties sur toute la durée, puis supprime le fichier. Gère les vidéos plus courtes que
    n_frames (positions dédupliquées) et les vidéos illisibles (liste vide).

    Lève `ValueError` si la chaîne base64 est invalide (l'appelant peut répondre 422).
    """
    n_frames = max(1, n_frames)

    try:
        video_bytes = base64.b64decode(video_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Vidéo base64 invalide.") from exc

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".mp4")
    frames: list[Image.Image] = []
    try:
        with os.fdopen(tmp_fd, "wb") as tmp_file:
            tmp_file.write(video_bytes)

        cap = cv2.VideoCapture(tmp_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if total_frames <= 0:
            cap.release()
            return []

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

        cap.release()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return frames
