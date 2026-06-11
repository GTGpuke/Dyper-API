"""Compréhension globale des médias par modèle vision-langage (Groq, optionnel).

Produit une analyse structurée : compte rendu riche, liste des éléments réellement visibles
(vocabulaire du détecteur à vocabulaire ouvert — pipeline « décrire puis ancrer »), scène et
cadre intérieur/extérieur. Tout est best-effort : sans clé API ou en cas d'échec, retourne None
et l'appelant retombe sur le pipeline COCO local (détection + description template).
"""

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

    try:
        client = _get_client()
        completion = await client.chat.completions.create(
            model=settings.VISION_MODEL,
            max_tokens=1024,
            timeout=settings.VISION_TIMEOUT_S,
            messages=[{"role": "user", "content": content}],
        )
        raw = (completion.choices[0].message.content or "").strip()
        if not raw:
            return None
        analysis = _parse_structured(raw)
        return analysis if analysis.description else None
    except Exception as exc:  # noqa: BLE001 — best-effort : tout échec déclenche le repli local.
        logger.warning(f"Compréhension vision indisponible, repli sur le pipeline local : {exc}")
        return None
