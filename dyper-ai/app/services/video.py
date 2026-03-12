"""Extraction de frames représentatives depuis une vidéo encodée en base64."""

import base64
import os
import tempfile
from typing import List

import cv2
from PIL import Image


def extract_frames(video_base64: str, n_frames: int = 5) -> List[Image.Image]:
    """Extrait n_frames images réparties uniformément depuis une vidéo base64.

    Décode la vidéo, capture les frames aux positions 0 %, 25 %, 50 %, 75 % et 100 %
    de la durée totale, puis supprime le fichier temporaire.
    """
    # Décoder le base64 en bytes et écrire dans un fichier temporaire.
    video_bytes = base64.b64decode(video_base64)
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".mp4")
    try:
        with os.fdopen(tmp_fd, "wb") as tmp_file:
            tmp_file.write(video_bytes)

        cap = cv2.VideoCapture(tmp_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if total_frames <= 0:
            cap.release()
            return []

        # Calcul des positions en pourcentage de la durée totale.
        positions = [int(total_frames * i / (n_frames - 1)) for i in range(n_frames)]
        # Clamp de la dernière position pour éviter un dépassement d'index.
        positions[-1] = min(positions[-1], total_frames - 1)

        frames: List[Image.Image] = []
        for pos in positions:
            cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
            ret, frame = cap.read()
            if ret:
                # Convertir BGR (OpenCV) vers RGB (PIL).
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frames.append(Image.fromarray(frame_rgb))

        cap.release()
    finally:
        # Supprimer le fichier temporaire dans tous les cas.
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return frames
