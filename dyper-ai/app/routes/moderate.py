"""Route de modération de contenu POST /moderate du service dyper-ai.

Sert le feed public « Global » de la passerelle : classe une image ou un texte. La politique
(bloquer tout ce qui n'est pas « safe ») est appliquée côté passerelle, pas ici.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.schemas.request import ModerationRequest
from app.schemas.response import ModerationResponse
from app.services import moderation
from app.utils.auth import verify_internal_key

router = APIRouter()


@router.post("/moderate", response_model=ModerationResponse)
async def moderate(
    body: ModerationRequest,
    _: None = Depends(verify_internal_key),
) -> ModerationResponse:
    """Classe une image ou un texte pour la modération du feed public."""
    if not moderation.is_available():
        return ModerationResponse(available=False, rating=None)

    if body.kind == "image":
        if not body.imageBase64:
            raise HTTPException(
                status_code=422, detail="Le champ imageBase64 est requis pour kind « image »."
            )
        rating = await moderation.classify_image(body.imageBase64, body.lang)
    else:
        if not body.text:
            raise HTTPException(
                status_code=422, detail="Le champ text est requis pour kind « text »."
            )
        rating = await moderation.moderate_text(body.text, body.lang)

    return ModerationResponse(available=True, rating=rating)
