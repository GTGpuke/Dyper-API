"""Téléchargement contrôlé de vidéos depuis les plateformes autorisées (YouTube, Twitch).

Utilise yt-dlp avec une liste blanche d'hôtes stricte, une vérification de durée AVANT
téléchargement (garde des 5 minutes) et des plafonds de résolution et de taille. La fusion
audio/vidéo s'appuie sur le binaire ffmpeg embarqué (imageio-ffmpeg), sans installation système.
"""

import asyncio
import os
import tempfile
from typing import Any
from urllib.parse import urlparse

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class VideoUrlError(Exception):
    """Erreur de téléchargement de vidéo par URL (mappée en 422 par la route)."""


def is_allowed_url(url: str) -> bool:
    """Vérifie que l'URL est http(s) et que son hôte appartient à la liste blanche."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    allowed = [h.strip().lower() for h in settings.VIDEO_URL_ALLOWED_HOSTS.split(",") if h.strip()]
    return any(host == domain or host.endswith(f".{domain}") for domain in allowed)


def _base_options() -> dict[str, Any]:
    """Options yt-dlp communes : silencieux, sans playlist, ffmpeg embarqué."""
    import imageio_ffmpeg

    return {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "ffmpeg_location": imageio_ffmpeg.get_ffmpeg_exe(),
    }


def _fetch_duration_sync(url: str) -> float | None:
    """Récupère la durée (secondes) des métadonnées, sans télécharger."""
    import yt_dlp

    with yt_dlp.YoutubeDL(_base_options()) as ydl:
        info = ydl.extract_info(url, download=False)
    duration = info.get("duration") if isinstance(info, dict) else None
    return float(duration) if duration else None


def _download_sync(url: str) -> str:
    """Télécharge la vidéo en mp4 plafonné en résolution et retourne le chemin temporaire."""
    import yt_dlp

    fd, tmp_path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    os.remove(tmp_path)  # yt-dlp exige un chemin libre.

    height = settings.VIDEO_URL_MAX_HEIGHT
    options = {
        **_base_options(),
        # mp4 progressif de préférence (pas de fusion), sinon meilleure piste ≤ plafond.
        "format": (
            f"best[ext=mp4][height<={height}]/"
            f"bestvideo[ext=mp4][height<={height}]+bestaudio[ext=m4a]/"
            f"best[height<={height}]/best"
        ),
        "merge_output_format": "mp4",
        "max_filesize": settings.VIDEO_URL_MAX_BYTES,
        "outtmpl": tmp_path,
    }
    with yt_dlp.YoutubeDL(options) as ydl:
        ydl.download([url])

    if not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
        raise VideoUrlError("Impossible de télécharger la vidéo depuis cette URL.")
    return tmp_path


async def download_video_from_url(url: str) -> str:
    """Valide puis télécharge une vidéo de plateforme. Retourne le chemin du fichier temporaire.

    Lève `VideoUrlError` (messages français) : URL hors liste blanche, durée excessive,
    ou échec de téléchargement. L'appelant est responsable de la suppression du fichier.
    """
    if not is_allowed_url(url):
        raise VideoUrlError("URL vidéo non autorisée (YouTube et Twitch uniquement).")

    # La durée est vérifiée AVANT le téléchargement (métadonnées seules).
    try:
        duration = await asyncio.to_thread(_fetch_duration_sync, url)
    except Exception as exc:
        logger.warning(f"Métadonnées vidéo inaccessibles pour {url} : {exc}")
        raise VideoUrlError("Impossible de télécharger la vidéo depuis cette URL.") from exc

    if duration is not None and duration > settings.VIDEO_MAX_DURATION_S:
        raise VideoUrlError("La vidéo dépasse la durée maximale autorisée de 5 minutes.")

    try:
        return await asyncio.to_thread(_download_sync, url)
    except VideoUrlError:
        raise
    except Exception as exc:
        logger.warning(f"Échec du téléchargement vidéo pour {url} : {exc}")
        raise VideoUrlError("Impossible de télécharger la vidéo depuis cette URL.") from exc
