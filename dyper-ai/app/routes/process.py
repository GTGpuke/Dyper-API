"""Route principale POST /process du service dyper-ai."""

import time
from collections import Counter
from io import BytesIO
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from PIL import Image

from app.config import settings
from app.schemas.request import ProcessRequest
from app.schemas.response import ProcessResponse, Visualization
from app.services import description as desc_service
from app.services.detector import detect
from app.utils.auth import verify_internal_key
from app.utils.image import decode_base64, resize_for_model
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


async def _load_image_from_url(url: str) -> Image.Image:
    """Télécharge une image depuis une URL publique (http/https uniquement) et la retourne en RGB."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=422, detail="URL d'image invalide (schéma http/https requis)."
        )

    try:
        async with httpx.AsyncClient(timeout=settings.IMAGE_FETCH_TIMEOUT) as client:
            response = await client.get(url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=422, detail="Impossible de récupérer l'image depuis l'URL."
        ) from exc

    try:
        return Image.open(BytesIO(response.content)).convert("RGB")
    except Exception as exc:  # noqa: BLE001 — toute erreur de décodage devient un 422 client.
        raise HTTPException(
            status_code=422, detail="Le contenu de l'URL n'est pas une image valide."
        ) from exc


def _aggregate_video_responses(responses: list[ProcessResponse], lang: str) -> ProcessResponse:
    """Agrège les réponses de plusieurs frames vidéo en une seule.

    Fusionne les objets uniques (meilleure confiance), choisit la scène la plus fréquente,
    agrège les tags, et régénère la description dans la langue demandée.
    """
    if not responses:
        raise ValueError("Aucune réponse à agréger.")

    best_conf: dict[str, float] = {}
    best_obj: dict = {}
    for resp in responses:
        for obj in resp.visualization.objects:
            if obj.label not in best_conf or obj.confidence > best_conf[obj.label]:
                best_conf[obj.label] = obj.confidence
                best_obj[obj.label] = obj
    merged_objects = list(best_obj.values())

    scene_labels = [resp.visualization.scene.label for resp in responses]
    most_common_label = Counter(scene_labels).most_common(1)[0][0]
    best_scene = next(
        resp.visualization.scene
        for resp in responses
        if resp.visualization.scene.label == most_common_label
    )

    colors = responses[0].visualization.colors
    all_tags = sorted({tag for resp in responses for tag in resp.visualization.tags})
    description_text = desc_service.generate(merged_objects, best_scene, None, lang)

    visualization = Visualization(
        objects=merged_objects,
        scene=best_scene,
        colors=colors,
        text=[],
        tags=all_tags,
    )

    return ProcessResponse(
        requestId=responses[-1].requestId,
        description=description_text,
        visualization=visualization,
        model=responses[-1].model,
        processingTimeMs=sum(resp.processingTimeMs for resp in responses),
    )


@router.post("/process", response_model=ProcessResponse)
async def process(
    body: ProcessRequest,
    request: Request,
    _: None = Depends(verify_internal_key),
) -> ProcessResponse:
    """Traite une requête multimodale (image, vidéo ou prompt) et retourne une analyse structurée."""
    runner = request.app.state.runner
    start = time.time()

    try:
        if body.type == "image":
            if body.imageBase64:
                try:
                    image = decode_base64(body.imageBase64)
                except ValueError as exc:
                    raise HTTPException(status_code=422, detail=str(exc)) from exc
            elif body.imageUrl:
                image = await _load_image_from_url(body.imageUrl)
            else:
                raise HTTPException(status_code=422, detail="imageBase64 ou imageUrl requis.")

            image = resize_for_model(image, settings.IMAGE_MAX_DIM)
            result = detect(image, runner, body.prompt, body.lang, body.requestId)

        elif body.type == "video":
            if not body.videoBase64:
                raise HTTPException(
                    status_code=422, detail="videoBase64 requis pour le type video."
                )

            # Import différé : n'importe OpenCV que lorsqu'une vidéo est réellement traitée.
            from app.services import video as video_service

            try:
                frames = video_service.extract_frames(
                    body.videoBase64, n_frames=settings.VIDEO_FRAMES
                )
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc

            if not frames:
                raise HTTPException(
                    status_code=422, detail="Impossible d'extraire des frames de la vidéo."
                )

            frame_responses = [
                detect(
                    resize_for_model(frame, settings.IMAGE_MAX_DIM),
                    runner,
                    body.prompt,
                    body.lang,
                    body.requestId,
                )
                for frame in frames
            ]
            result = _aggregate_video_responses(frame_responses, body.lang)

        else:  # type == "prompt"
            blank_image = Image.new("RGB", (100, 100), "white")
            result = detect(blank_image, runner, body.prompt, body.lang, body.requestId)

        result.processingTimeMs = int((time.time() - start) * 1000)
        return result

    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — filet de sécurité : toute autre erreur → 500 générique.
        logger.error(f"Erreur lors du traitement de la requête {body.requestId} : {exc}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur.") from exc
