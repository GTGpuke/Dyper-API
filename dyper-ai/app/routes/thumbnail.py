"""Route POST /thumbnail : résout l'URL de la miniature d'une vidéo de plateforme (aperçu).

Sert l'encart d'aperçu de la passerelle : pour un lien YouTube/Twitch collé dans le composer,
retourne l'URL de la miniature (via les métadonnées yt-dlp, sans téléchargement). Best-effort :
URL non autorisée ou miniature absente → null, jamais d'erreur (l'aperçu n'est pas critique).
"""

from fastapi import APIRouter, Depends

from app.schemas.request import ThumbnailRequest
from app.schemas.response import ThumbnailResponse
from app.services import video_download
from app.utils.auth import verify_internal_key

router = APIRouter()


@router.post("/thumbnail", response_model=ThumbnailResponse)
async def thumbnail(
    body: ThumbnailRequest,
    _: None = Depends(verify_internal_key),
) -> ThumbnailResponse:
    """Retourne la miniature d'une vidéo de plateforme pour l'aperçu (None si indisponible)."""
    url = await video_download.fetch_thumbnail_url(body.url)
    return ThumbnailResponse(thumbnailUrl=url)
