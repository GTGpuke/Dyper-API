"""Analyse de la piste audio d'une vidéo : transcription (Whisper) et reconnaissance musicale.

L'audio est extrait par le binaire ffmpeg embarqué dans la wheel imageio-ffmpeg (aucune
installation système), converti en mono 16 kHz. La parole est transcrite par Whisper (Groq) ;
la bande-son est identifiée par fingerprinting AudD (type Shazam) sur un extrait court.
Tout est best-effort : vidéo sans piste audio, clés absentes ou échec API → None, sans erreur.
"""

import asyncio
import os
import subprocess
import tempfile
from typing import Any

import httpx

from app.config import settings
from app.schemas.response import MusicInfo, TranscriptSegment
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Taille maximale du fichier audio envoyé à l'API (limite Groq : 25 Mo).
_MAX_AUDIO_BYTES = 24 * 1024 * 1024

# Point d'entrée de l'API de reconnaissance musicale AudD.
_AUDD_URL = "https://api.audd.io/"

# Client AsyncGroq paresseux, partagé avec le service vision via le même schéma.
_client: Any = None


def is_available() -> bool:
    """Indique si la transcription audio est activée (clé Groq présente)."""
    return bool(settings.GROQ_API_KEY)


def music_available() -> bool:
    """Indique si la reconnaissance musicale est activée (jeton AudD présent)."""
    return bool(settings.AUDD_API_TOKEN)


def _get_client() -> Any:
    """Retourne le client AsyncGroq (singleton paresseux)."""
    global _client
    if _client is None:
        from groq import AsyncGroq

        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


def build_ffmpeg_command(
    ffmpeg_path: str, video_path: str, audio_path: str, max_seconds: int | None = None
) -> list[str]:
    """Construit la commande d'extraction audio : mono, 16 kHz, AAC (léger pour les APIs).

    `max_seconds` limite la durée extraite (extrait court pour le fingerprinting musical).
    """
    command = [ffmpeg_path, "-y", "-i", video_path, "-vn", "-ac", "1", "-ar", "16000"]
    if max_seconds is not None:
        command += ["-t", str(max_seconds)]
    command += ["-c:a", "aac", "-b:a", "48k", audio_path]
    return command


def extract_audio(video_path: str, max_seconds: int | None = None) -> str | None:
    """Extrait la piste audio d'une vidéo vers un fichier temporaire .m4a.

    Retourne le chemin du fichier audio, ou None si la vidéo n'a pas de piste audio,
    si ffmpeg échoue, ou si le résultat dépasse la limite de taille des APIs.
    """
    import imageio_ffmpeg

    fd, audio_path = tempfile.mkstemp(suffix=".m4a")
    os.close(fd)
    try:
        command = build_ffmpeg_command(
            imageio_ffmpeg.get_ffmpeg_exe(), video_path, audio_path, max_seconds
        )
        completed = subprocess.run(command, capture_output=True, timeout=60, check=False)
        if completed.returncode != 0 or not os.path.exists(audio_path):
            logger.info("Aucune piste audio exploitable dans la vidéo.")
            _cleanup(audio_path)
            return None
        size = os.path.getsize(audio_path)
        if size == 0 or size > _MAX_AUDIO_BYTES:
            logger.info(f"Piste audio ignorée (taille {size} octets hors limites).")
            _cleanup(audio_path)
            return None
        return audio_path
    except Exception as exc:  # noqa: BLE001 — best-effort : tout échec est non bloquant.
        logger.warning(f"Échec de l'extraction audio : {exc}")
        _cleanup(audio_path)
        return None


def _cleanup(path: str | None) -> None:
    """Supprime un fichier temporaire en ignorant les erreurs."""
    if not path:
        return
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass


def _parse_transcript_segments(transcription: Any) -> list[TranscriptSegment] | None:
    """Extrait les tranches horodatées d'une réponse Whisper verbose (tolérant)."""
    raw_segments = getattr(transcription, "segments", None)
    if not raw_segments:
        return None
    segments: list[TranscriptSegment] = []
    for raw in raw_segments:
        # Les segments arrivent en objets ou en dictionnaires selon les versions du SDK.
        if isinstance(raw, dict):
            start, end, text = raw.get("start"), raw.get("end"), raw.get("text")
        else:
            start = getattr(raw, "start", None)
            end = getattr(raw, "end", None)
            text = getattr(raw, "text", None)
        if start is None or end is None or not text or not str(text).strip():
            continue
        segments.append(
            TranscriptSegment(
                start=round(float(start), 2), end=round(float(end), 2), text=str(text).strip()
            )
        )
    return segments or None


async def transcribe_file(
    audio_path: str,
) -> tuple[str | None, list[TranscriptSegment] | None]:
    """Transcrit un fichier audio via Whisper (Groq), avec tranches horodatées.

    Retourne (texte complet, tranches) — (None, None) sur tout échec.
    """
    if not is_available():
        return None, None
    try:
        client = _get_client()
        with open(audio_path, "rb") as audio_file:
            transcription = await client.audio.transcriptions.create(
                file=("audio.m4a", audio_file.read()),
                model=settings.WHISPER_MODEL,
                response_format="verbose_json",
                timeout=settings.AUDIO_TIMEOUT_S,
            )
        text = (transcription.text or "").strip()
        if not text:
            return None, None
        return text, _parse_transcript_segments(transcription)
    except Exception as exc:  # noqa: BLE001 — best-effort : tout échec est non bloquant.
        logger.warning(f"Transcription audio indisponible : {exc}")
        return None, None


async def recognize_music_file(audio_path: str) -> MusicInfo | None:
    """Identifie la bande-son d'un extrait audio via AudD. Retourne None sur tout échec."""
    if not music_available():
        return None
    try:
        with open(audio_path, "rb") as audio_file:
            audio_bytes = audio_file.read()
        async with httpx.AsyncClient(timeout=settings.AUDIO_TIMEOUT_S) as client:
            response = await client.post(
                _AUDD_URL,
                data={"api_token": settings.AUDD_API_TOKEN},
                files={"file": ("audio.m4a", audio_bytes, "audio/mp4")},
            )
        payload = response.json()
        result = payload.get("result") if payload.get("status") == "success" else None
        if not result or not result.get("title"):
            return None
        return MusicInfo(
            artist=result.get("artist") or "Inconnu",
            title=result["title"],
            album=result.get("album") or None,
        )
    except Exception as exc:  # noqa: BLE001 — best-effort : tout échec est non bloquant.
        logger.warning(f"Reconnaissance musicale indisponible : {exc}")
        return None


async def analyze_audio(
    video_path: str,
) -> tuple[str | None, list[TranscriptSegment] | None, MusicInfo | None]:
    """Analyse complète de la piste audio : transcription horodatée + reconnaissance musicale.

    L'extraction est faite une seule fois (piste complète pour Whisper, extrait court pour
    le fingerprinting AudD), puis les deux appels réseau sont exécutés en parallèle.
    Retourne (texte complet, tranches horodatées, musique).
    """
    if not is_available() and not music_available():
        return None, None, None

    full_path = extract_audio(video_path)
    if full_path is None:
        return None, None, None

    excerpt_path = (
        extract_audio(video_path, max_seconds=settings.MUSIC_EXCERPT_S)
        if music_available()
        else None
    )
    try:
        (transcript, segments), music = await asyncio.gather(
            transcribe_file(full_path),
            recognize_music_file(excerpt_path) if excerpt_path else _none(),
        )
        return transcript, segments, music
    finally:
        _cleanup(full_path)
        _cleanup(excerpt_path)


async def _none() -> None:
    """Coroutine neutre pour aligner asyncio.gather quand la reconnaissance est désactivée."""
    return None
