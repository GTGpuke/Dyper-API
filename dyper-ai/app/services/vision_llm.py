"""Compréhension globale des médias par modèle vision-langage (Groq, optionnel).

Produit une analyse structurée : compte rendu riche, liste des éléments réellement visibles
(vocabulaire du détecteur à vocabulaire ouvert — pipeline « décrire puis ancrer »), scène et
cadre intérieur/extérieur. Tout est best-effort : sans clé API ou en cas d'échec, retourne None
et l'appelant retombe sur le pipeline COCO local (détection + description template).
"""

import asyncio
import re
from dataclasses import dataclass, field
from typing import Any

from PIL import Image

from app.config import settings
from app.utils.image import to_thumbnail_base64
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Client AsyncGroq paresseux (instancié au premier appel, uniquement si la clé est présente).
_client: Any = None

# Lignes structurées attendues en fin de réponse du modèle vision.
_STRUCTURED_LINE = re.compile(r"^\s*(ELEMENTS|SCENE|INDOOR)\s*:\s*(.*)$", re.IGNORECASE)


@dataclass
class VisionAnalysis:
    """Analyse vision structurée : compte rendu + vocabulaire de détection + scène."""

    description: str
    elements: list[str] = field(default_factory=list)
    scene_label: str | None = None
    indoor: bool | None = None


def is_available() -> bool:
    """Indique si la compréhension multimodale est activée (clé Groq présente)."""
    return bool(settings.GROQ_API_KEY)


def _get_client() -> Any:
    """Retourne le client AsyncGroq (singleton paresseux)."""
    global _client
    if _client is None:
        from groq import AsyncGroq

        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


def _build_instructions(
    lang: str,
    prompt: str | None,
    transcript: str | None,
    music_summary: str | None,
    is_video: bool,
) -> str:
    """Assemble les consignes : compte rendu riche + lignes structurées finales."""
    response_lang = "anglais" if lang == "en" else "français"
    media = "des images clés extraites d'une vidéo" if is_video else "une image"

    parts = [
        f"Tu es un analyste visuel expert. Tu reçois {media} à analyser.",
        "Rédige un compte rendu riche, factuel et structuré en prose (150 à 250 mots) couvrant :",
        "le contexte global de la scène, les éléments et personnes notables, les actions en cours,",
        "l'ambiance générale, et tout texte lisible dans l'image le cas échéant.",
        "Ne décris que ce qui est réellement visible — n'invente rien.",
    ]
    if transcript:
        parts.append(f"Transcription audio de la vidéo : « {transcript} ».")
    if music_summary:
        parts.append(f"Bande-son identifiée : {music_summary}.")
    if prompt:
        parts.append(f"Question de l'utilisateur à traiter en priorité : « {prompt} ».")
    parts.append(f"Rédige le compte rendu exclusivement en {response_lang}, sans titres.")
    parts.append(
        "Termine ta réponse par exactement trois lignes, chacune sur sa propre ligne :\n"
        "ELEMENTS: <3 à 20 éléments visibles et localisables, en groupes nominaux ANGLAIS "
        "courts (1 à 3 mots, ex. « metal fence »), séparés par des virgules, du plus important "
        "au moins important>\n"
        f"SCENE: <étiquette très courte de la scène, en {response_lang}>\n"
        "INDOOR: <oui|non|inconnu>"
    )
    return " ".join(parts)


def _parse_structured(raw: str) -> VisionAnalysis:
    """Sépare le compte rendu des lignes structurées (parsing tolérant, champs manquants → vides)."""
    description_lines: list[str] = []
    elements: list[str] = []
    scene_label: str | None = None
    indoor: bool | None = None

    for line in raw.splitlines():
        match = _STRUCTURED_LINE.match(line)
        if not match:
            description_lines.append(line)
            continue
        key, value = match.group(1).upper(), match.group(2).strip()
        if key == "ELEMENTS":
            seen: set[str] = set()
            for item in value.split(","):
                cleaned = item.strip().strip(".").lower()
                # Groupes nominaux courts uniquement (le détecteur encode des concepts simples).
                if cleaned and len(cleaned) <= 40 and cleaned not in seen:
                    seen.add(cleaned)
                    elements.append(cleaned)
            elements = elements[: settings.WORLD_MAX_CLASSES]
        elif key == "SCENE" and value:
            scene_label = value.strip(".")
        elif key == "INDOOR":
            normalized = value.strip(".").lower()
            indoor = True if normalized == "oui" else False if normalized == "non" else None

    return VisionAnalysis(
        description="\n".join(description_lines).strip(),
        elements=elements,
        scene_label=scene_label,
        indoor=indoor,
    )


async def describe_and_extract(
    images: list[Image.Image],
    lang: str,
    prompt: str | None,
    transcript: str | None = None,
    music_summary: str | None = None,
    is_video: bool = False,
) -> VisionAnalysis | None:
    """Analyse vision structurée (compte rendu + éléments + scène). None sur tout échec.

    Les instructions sont placées dans le message utilisateur (compatibilité maximale des
    modèles multimodaux avec les contenus mixtes texte + images).
    """
    if not is_available() or not images:
        return None

    content: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": _build_instructions(lang, prompt, transcript, music_summary, is_video),
        }
    ]
    for image in images[: settings.VISION_MAX_FRAMES]:
        data_url = "data:image/jpeg;base64," + to_thumbnail_base64(
            image, max_dim=settings.VISION_IMAGE_MAX_DIM
        )
        content.append({"type": "image_url", "image_url": {"url": data_url}})

    return await _call_and_parse(content, max_tokens=1024)


async def describe_segment(
    images: list[Image.Image],
    lang: str,
    transcript_slice: str | None,
) -> VisionAnalysis | None:
    """Analyse vision courte d'un chapitre vidéo : 1-2 phrases + éléments visibles.

    Utilisée par segments temporels pour aligner ce qu'on voit avec ce qu'on entend.
    Retourne None sur tout échec (le chapitre reste alors sans description).
    """
    if not is_available() or not images:
        return None

    response_lang = "anglais" if lang == "en" else "français"
    parts = [
        "Tu es un analyste visuel. Tu reçois une ou deux images d'un court segment de vidéo.",
        f"Décris en 1 à 2 phrases ({response_lang}) ce qui se passe sur ce segment précis.",
        "Ne décris que ce qui est réellement visible — n'invente rien.",
    ]
    if transcript_slice:
        parts.append(f"Paroles entendues sur ce segment : « {transcript_slice} ».")
    parts.append(
        "Termine ta réponse par une seule ligne :\n"
        "ELEMENTS: <3 à 10 éléments visibles, groupes nominaux ANGLAIS courts (1 à 3 mots), "
        "séparés par des virgules>"
    )

    # Une seule image réduite par segment : divise par ~3 le coût en tokens (le palier
    # gratuit Groq est limité en tokens/minute, et les chapitres multiplient les appels).
    content: list[dict[str, Any]] = [{"type": "text", "text": " ".join(parts)}]
    for image in images[:1]:
        data_url = "data:image/jpeg;base64," + to_thumbnail_base64(
            image, max_dim=settings.VISION_SEGMENT_IMAGE_MAX_DIM
        )
        content.append({"type": "image_url", "image_url": {"url": data_url}})

    return await _call_and_parse(content, max_tokens=300)


# Nombre de tentatives par appel vision (le palier gratuit Groq limite les tokens/minute).
_MAX_ATTEMPTS = 4

# Délai d'attente suggéré par l'API dans le message d'erreur 429 (« try again in 4.4s »).
_RETRY_HINT = re.compile(r"try again in ([0-9.]+)s")


def _is_rate_limited(exc: Exception) -> bool:
    """Détecte une erreur de limite de débit (429) de l'API Groq."""
    return getattr(exc, "status_code", None) == 429 or "rate_limit" in str(exc)


def _retry_delay(exc: Exception, attempt: int) -> float:
    """Délai avant nouvelle tentative : celui suggéré par l'API, sinon backoff progressif."""
    match = _RETRY_HINT.search(str(exc))
    if match:
        return min(float(match.group(1)) + 0.5, 20.0)
    return float(2**attempt)


async def _call_and_parse(content: list[dict[str, Any]], max_tokens: int) -> VisionAnalysis | None:
    """Appelle le modèle vision et parse la réponse structurée. None sur tout échec.

    Les erreurs de limite de débit (429) sont réessayées avec le délai suggéré par
    l'API — indispensable sur le palier gratuit Groq quand les chapitres sont nombreux.
    """
    for attempt in range(_MAX_ATTEMPTS):
        try:
            client = _get_client()
            completion = await client.chat.completions.create(
                model=settings.VISION_MODEL,
                max_tokens=max_tokens,
                timeout=settings.VISION_TIMEOUT_S,
                messages=[{"role": "user", "content": content}],
            )
            raw = (completion.choices[0].message.content or "").strip()
            if not raw:
                return None
            analysis = _parse_structured(raw)
            return analysis if analysis.description else None
        except Exception as exc:  # noqa: BLE001 — best-effort : tout échec déclenche le repli.
            if _is_rate_limited(exc) and attempt < _MAX_ATTEMPTS - 1:
                delay = _retry_delay(exc, attempt)
                logger.info(f"Limite de débit Groq atteinte : nouvelle tentative dans {delay} s.")
                await asyncio.sleep(delay)
                continue
            logger.warning(
                f"Compréhension vision indisponible, repli sur le pipeline local : {exc}"
            )
            return None
    return None
