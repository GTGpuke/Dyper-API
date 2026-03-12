"""Schémas Pydantic pour les réponses structurées du service dyper-ai."""

from pydantic import BaseModel
from typing import List, Optional


class BoundingBox(BaseModel):
    """Boîte englobante d'un objet détecté, exprimée en pixels."""

    x: float
    y: float
    w: float
    h: float


class DetectedObject(BaseModel):
    """Objet détecté par YOLO avec son label, sa confiance et sa position."""

    label: str
    confidence: float
    boundingBox: Optional[BoundingBox] = None


class Scene(BaseModel):
    """Scène inférée à partir des objets détectés."""

    label: str
    confidence: float
    indoor: Optional[bool] = None


class Visualization(BaseModel):
    """Données structurées de visualisation extraites de l'image."""

    objects: List[DetectedObject]
    scene: Scene
    colors: List[str]
    text: List[str]
    tags: List[str]


class ProcessResponse(BaseModel):
    """Réponse complète du pipeline de traitement dyper-ai."""

    requestId: str
    description: str
    visualization: Visualization
    model: str
    processingTimeMs: int
