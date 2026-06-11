"""Schémas Pydantic pour les réponses structurées du service dyper-ai."""

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """Boîte englobante d'un objet détecté, exprimée en pixels (coin supérieur gauche + taille)."""

    x: float = Field(..., description="Coordonnée X du coin supérieur gauche.")
    y: float = Field(..., description="Coordonnée Y du coin supérieur gauche.")
    w: float = Field(..., description="Largeur de la boîte.")
    h: float = Field(..., description="Hauteur de la boîte.")


class DetectedObject(BaseModel):
    """Objet détecté par YOLO avec son label COCO, sa confiance et sa position."""

    label: str = Field(..., description="Label COCO brut (anglais), ex. « laptop ».")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Score de confiance (0 → 1).")
    boundingBox: BoundingBox | None = None
    trackId: int | None = Field(
        default=None, description="Identifiant de piste stable entre frames (vidéos trackées)."
    )


class Scene(BaseModel):
    """Scène inférée à partir des objets détectés (label localisé selon la langue)."""

    label: str = Field(..., description="Label de scène localisé.")
    confidence: float = Field(..., ge=0.0, le=1.0)
    indoor: bool | None = Field(
        default=None, description="Vrai si intérieur, faux si extérieur, null si indéterminé."
    )


class Visualization(BaseModel):
    """Données structurées de visualisation extraites de l'image."""

    objects: list[DetectedObject]
    scene: Scene
    colors: list[str] = Field(..., description="Couleurs dominantes au format #RRGGBB.")
    text: list[str] = Field(
        default_factory=list, description="Réservé à l'OCR (toujours [] en v1)."
    )
    tags: list[str] = Field(..., description="Labels uniques des objets détectés.")


class TimelineEntry(BaseModel):
    """Présence d'objets à un instant donné d'une vidéo (chronologie d'apparition)."""

    t: float = Field(..., ge=0.0, description="Horodatage de la frame analysée (secondes).")
    labels: list[str] = Field(..., description="Labels des objets détectés à cet instant.")


class FrameDetections(BaseModel):
    """Détections complètes d'une frame échantillonnée (lecteur vidéo annoté)."""

    t: float = Field(..., ge=0.0, description="Horodatage de la frame analysée (secondes).")
    objects: list[DetectedObject] = Field(
        ..., description="Objets détectés sur cette frame (avec trackId et boîtes)."
    )


class MusicInfo(BaseModel):
    """Bande-son identifiée par fingerprinting (reconnaissance musicale)."""

    artist: str = Field(..., description="Artiste identifié.")
    title: str = Field(..., description="Titre du morceau.")
    album: str | None = Field(default=None, description="Album, si connu.")


class TranscriptSegment(BaseModel):
    """Tranche horodatée de la transcription audio (alignement temporel)."""

    start: float = Field(..., ge=0.0, description="Début de la tranche (secondes).")
    end: float = Field(..., ge=0.0, description="Fin de la tranche (secondes).")
    text: str = Field(..., description="Texte transcrit sur cette tranche.")


class Chapter(BaseModel):
    """Chapitre d'analyse vidéo : ce qu'on voit et ce qu'on entend sur un intervalle."""

    tStart: float = Field(..., ge=0.0, description="Début du chapitre (secondes).")
    tEnd: float = Field(..., ge=0.0, description="Fin du chapitre (secondes).")
    description: str | None = Field(
        default=None, description="Description visuelle courte du chapitre."
    )
    elements: list[str] = Field(
        default_factory=list, description="Éléments visibles identifiés sur ce chapitre."
    )
    transcript: str | None = Field(
        default=None, description="Tranche de transcription audio du chapitre."
    )


class ProcessResponse(BaseModel):
    """Réponse complète du pipeline de traitement dyper-ai."""

    requestId: str
    description: str = Field(..., description="Phrase naturelle générée à partir des détections.")
    visualization: Visualization
    model: str = Field(..., description="Variante de modèle utilisée, ex. « yolo26l ».")
    processingTimeMs: int = Field(..., description="Durée de traitement en millisecondes.")
    # Champs optionnels (contrat rétrocompatible) ajoutés pour l'expérience conversationnelle.
    thumbnailBase64: str | None = Field(
        default=None, description="Miniature JPEG (base64) de l'image analysée."
    )
    timeline: list[TimelineEntry] | None = Field(
        default=None, description="Chronologie d'apparition des objets (vidéos uniquement)."
    )
    sourceWidth: int | None = Field(
        default=None, description="Largeur (px) de l'image analysée — référentiel des boîtes."
    )
    sourceHeight: int | None = Field(
        default=None, description="Hauteur (px) de l'image analysée — référentiel des boîtes."
    )
    audioTranscript: str | None = Field(
        default=None, description="Transcription de la piste audio (vidéos, si disponible)."
    )
    frames: list[FrameDetections] | None = Field(
        default=None,
        description="Détections par frame échantillonnée (vidéos) — lecteur annoté.",
    )
    music: MusicInfo | None = Field(
        default=None, description="Bande-son identifiée (vidéos, si disponible)."
    )
    videoBase64: str | None = Field(
        default=None,
        description="Vidéo téléchargée depuis une URL (base64) — renvoyée pour stockage.",
    )
    transcriptSegments: list[TranscriptSegment] | None = Field(
        default=None, description="Transcription horodatée par tranches (vidéos)."
    )
    chapters: list[Chapter] | None = Field(
        default=None,
        description="Chapitres d'analyse alignés vision/audio/détection (vidéos).",
    )
