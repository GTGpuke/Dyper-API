"""Schémas Pydantic pour les requêtes entrantes du service dyper-ai."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ProcessRequest(BaseModel):
    """Requête de traitement multimodal (image, vidéo ou prompt)."""

    requestId: str = Field(
        ..., description="Identifiant unique de la requête.", examples=["req_abc123"]
    )
    type: Literal["image", "video", "prompt"] = Field(..., description="Type d'analyse demandée.")
    imageBase64: str | None = Field(
        default=None, description="Image encodée en base64 (type=image)."
    )
    imageUrl: str | None = Field(default=None, description="URL publique de l'image (type=image).")
    videoBase64: str | None = Field(
        default=None, description="Vidéo encodée en base64 (type=video)."
    )
    videoUrl: str | None = Field(
        default=None,
        description="URL d'une vidéo de plateforme autorisée — YouTube, Twitch (type=video).",
    )
    prompt: str | None = Field(
        default=None, max_length=2000, description="Contexte textuel libre (optionnel)."
    )
    lang: str = Field(default="fr", description="Langue de la description : « fr » ou « en ».")

    @model_validator(mode="after")
    def _check_payload(self) -> "ProcessRequest":
        """Vérifie que le champ requis pour le type demandé est bien présent (sinon 422)."""
        if self.type == "image" and not (self.imageBase64 or self.imageUrl):
            raise ValueError("Le champ imageBase64 ou imageUrl est requis pour le type « image ».")
        if self.type == "video" and not (self.videoBase64 or self.videoUrl):
            raise ValueError("Le champ videoBase64 ou videoUrl est requis pour le type « video ».")
        if self.type == "prompt" and not self.prompt:
            raise ValueError("Le champ prompt est requis pour le type « prompt ».")
        return self


class ThumbnailRequest(BaseModel):
    """Requête de résolution de la miniature d'une vidéo de plateforme (aperçu avant analyse)."""

    url: str = Field(..., description="URL d'une vidéo de plateforme autorisée (YouTube, Twitch).")


class ModerationRequest(BaseModel):
    """Requête de modération de contenu (image ou texte) pour le feed public."""

    kind: Literal["image", "text"] = Field(..., description="Type de contenu à modérer.")
    imageBase64: str | None = Field(
        default=None, description="Image encodée en base64 (kind=image)."
    )
    text: str | None = Field(
        default=None, max_length=4000, description="Texte à modérer (kind=text)."
    )
    lang: str = Field(default="fr", description="Langue du contenu : « fr » ou « en ».")

    @model_validator(mode="after")
    def _check_payload(self) -> "ModerationRequest":
        """Vérifie que le champ requis pour le type de modération est présent (sinon 422)."""
        if self.kind == "image" and not self.imageBase64:
            raise ValueError("Le champ imageBase64 est requis pour kind « image ».")
        if self.kind == "text" and not self.text:
            raise ValueError("Le champ text est requis pour kind « text ».")
        return self
