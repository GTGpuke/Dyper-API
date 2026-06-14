"""Modération de contenu pour le feed public « Global » (Groq, optionnelle).

Classe une image (sûr / suggestif / explicite) et un texte de commentaire (sûr / toxique /
explicite) en réutilisant le client Groq. Best-effort : sans clé API, `is_available()` renvoie
False et la passerelle bloque la publication ou le commentaire par sécurité (fail-closed).
"""

import asyncio
import re
from typing import Any

from app.config import settings
from app.utils.image import decode_base64, to_thumbnail_base64
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Client AsyncGroq paresseux (instancié au premier appel, uniquement si la clé est présente).
_client: Any = None

_IMAGE_RATINGS = ("safe", "suggestive", "explicit")
_TEXT_RATINGS = ("safe", "toxic", "explicit")
_RATING_TOKEN = re.compile(r"\b(safe|suggestive|explicit|toxic)\b", re.IGNORECASE)

# Nombre de tentatives par appel (le palier gratuit Groq limite les tokens/minute).
_MAX_ATTEMPTS = 3
_RETRY_HINT = re.compile(r"try again in ([0-9.]+)s")


def is_available() -> bool:
    """Indique si la modération automatique est activée (clé Groq présente)."""
    return bool(settings.GROQ_API_KEY)


def _get_client() -> Any:
    """Retourne le client AsyncGroq (singleton paresseux)."""
    global _client
    if _client is None:
        from groq import AsyncGroq

        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


def _is_rate_limited(exc: Exception) -> bool:
    """Détecte une erreur de limite de débit (429) de l'API Groq."""
    return getattr(exc, "status_code", None) == 429 or "rate_limit" in str(exc)


def _retry_delay(exc: Exception, attempt: int) -> float:
    """Délai avant nouvelle tentative : celui suggéré par l'API, sinon backoff progressif."""
    match = _RETRY_HINT.search(str(exc))
    if match:
        return min(float(match.group(1)) + 0.5, 20.0)
    return float(2**attempt)


def _parse_rating(raw: str | None, allowed: tuple[str, ...]) -> str | None:
    """Extrait la classification de la réponse du modèle (None si indéterminée)."""
    if not raw or not raw.strip():
        return None
    # La consigne impose un seul mot : on teste d'abord le premier token nettoyé.
    first = re.sub(r"[^a-z]", "", raw.strip().lower().split()[0])
    if first in allowed:
        return first
    match = _RATING_TOKEN.search(raw.lower())
    if match and match.group(1) in allowed:
        return match.group(1)
    return None


async def _complete(messages: list[dict[str, Any]], model: str) -> str | None:
    """Appelle le modèle Groq et retourne le texte de la réponse. None sur tout échec.

    Les erreurs de limite de débit (429) sont réessayées avec le délai suggéré par l'API.
    """
    for attempt in range(_MAX_ATTEMPTS):
        try:
            client = _get_client()
            completion = await client.chat.completions.create(
                model=model,
                max_tokens=20,
                timeout=settings.MODERATION_TIMEOUT_S,
                messages=messages,
            )
            return (completion.choices[0].message.content or "").strip()
        except Exception as exc:  # noqa: BLE001 — best-effort : tout échec → modération indisponible.
            if _is_rate_limited(exc) and attempt < _MAX_ATTEMPTS - 1:
                await asyncio.sleep(_retry_delay(exc, attempt))
                continue
            logger.warning(f"Modération indisponible : {exc}")
            return None
    return None


async def classify_image(image_b64: str, lang: str = "fr") -> str | None:
    """Classe une image : « safe » / « suggestive » / « explicit ». None si indéterminé.

    `lang` est accepté pour l'uniformité de l'API mais n'influe pas (consigne en anglais,
    classification indépendante de la langue).
    """
    del lang  # Classification visuelle indépendante de la langue.
    if not is_available():
        return None
    try:
        image = decode_base64(image_b64)
    except ValueError:
        return None

    data_url = "data:image/jpeg;base64," + to_thumbnail_base64(
        image, max_dim=settings.VISION_IMAGE_MAX_DIM
    )
    instructions = (
        "You are a strict content-safety classifier for a public, all-audiences feed. "
        "Classify the image into exactly one label: "
        "SAFE (no nudity or sexual content, suitable for everyone), "
        "SUGGESTIVE (revealing or sexually suggestive but not explicit), "
        "EXPLICIT (nudity, pornography or sexual acts). "
        "Answer with only one word: SAFE, SUGGESTIVE or EXPLICIT."
    )
    content: list[dict[str, Any]] = [
        {"type": "text", "text": instructions},
        {"type": "image_url", "image_url": {"url": data_url}},
    ]
    raw = await _complete([{"role": "user", "content": content}], settings.MODERATION_IMAGE_MODEL)
    return _parse_rating(raw, _IMAGE_RATINGS)


async def moderate_text(text: str, lang: str = "fr") -> str | None:
    """Modère un commentaire : « safe » / « toxic » / « explicit ». None si indéterminé."""
    del lang  # Modération indépendante de la langue (consigne en anglais).
    if not is_available():
        return None

    instructions = (
        "You are a strict comment moderator for a public, all-audiences feed. "
        "Classify the user comment into exactly one label: "
        "SAFE (acceptable), "
        "TOXIC (hate speech, harassment, threats or slurs), "
        "EXPLICIT (sexual or pornographic content). "
        "Answer with only one word: SAFE, TOXIC or EXPLICIT.\n\n"
        f"Comment: {text}"
    )
    raw = await _complete(
        [{"role": "user", "content": instructions}], settings.MODERATION_TEXT_MODEL
    )
    return _parse_rating(raw, _TEXT_RATINGS)
