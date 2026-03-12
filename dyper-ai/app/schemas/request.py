"""Schémas Pydantic pour les requêtes entrantes du service dyper-ai."""

from pydantic import BaseModel
from typing import Literal, Optional


class ProcessRequest(BaseModel):
    """Requête de traitement multimodal (image, vidéo ou prompt)."""

    requestId: str
    type: Literal["image", "video", "prompt"]
    imageBase64: Optional[str] = None
    imageUrl: Optional[str] = None
    videoBase64: Optional[str] = None
    prompt: Optional[str] = None
    lang: str = "fr"
