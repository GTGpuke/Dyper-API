"""Route principale POST /process du service dyper-ai."""

import time
from collections import Counter
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from PIL import Image

from app.schemas.request import ProcessRequest
from app.schemas.response import DetectedObject, ProcessResponse, Scene, Visualization
from app.services import description as desc_service
from app.services import scene as scene_service
from app.services import video as video_service
from app.services.detector import detect
from app.utils.auth import verify_internal_key
from app.utils.image import decode_base64, get_dominant_colors, resize_for_model
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


def _aggregate_video_responses(responses: List[ProcessResponse]) -> ProcessResponse:
    """Agrège les réponses de détection de plusieurs frames vidéo en une seule réponse.

    Fusionne les objets uniques en conservant la meilleure confiance,
    choisit la scène la plus fréquente et agrège les couleurs dominantes.
    """
    if not responses:
        raise ValueError("Aucune réponse à agréger.")

    # Fusion des objets : conservation de la meilleure confiance par label.
    best_conf: dict = {}
    best_obj: dict = {}
    for resp in responses:
        for obj in resp.visualization.objects:
            if obj.label not in best_conf or obj.confidence > best_conf[obj.label]:
                best_conf[obj.label] = obj.confidence
                best_obj[obj.label] = obj

    merged_objects: List[DetectedObject] = list(best_obj.values())

    # Sélection de la scène la plus fréquente parmi toutes les frames.
    scene_labels = [resp.visualization.scene.label for resp in responses]
    most_common_label = Counter(scene_labels).most_common(1)[0][0]
    best_scene = next(
        resp.visualization.scene
        for resp in responses
        if resp.visualization.scene.label == most_common_label
    )

    # Agrégation des couleurs : on prend celles de la première frame.
    colors = responses[0].visualization.colors

    # Tags uniques issus de toutes les frames.
    all_tags = list(set(tag for resp in responses for tag in resp.visualization.tags))

    # Régénération de la description avec les objets agrégés.
    last_resp = responses[-1]
    description_text = desc_service.generate(
        merged_objects, best_scene, None, "fr"
    )

    visualization = Visualization(
        objects=merged_objects,
        scene=best_scene,
        colors=colors,
        text=[],
        tags=all_tags,
    )

    total_ms = sum(resp.processingTimeMs for resp in responses)

    return ProcessResponse(
        requestId=last_resp.requestId,
        description=description_text,
        visualization=visualization,
        model=last_resp.model,
        processingTimeMs=total_ms,
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
            # Chargement de l'image depuis base64 ou URL.
            if body.imageBase64:
                image = decode_base64(body.imageBase64)
            elif body.imageUrl:
                async with httpx.AsyncClient() as client:
                    response = await client.get(body.imageUrl, timeout=10.0)
                    response.raise_for_status()
                from io import BytesIO
                image = Image.open(BytesIO(response.content)).convert("RGB")
            else:
                raise HTTPException(
                    status_code=422,
                    detail="imageBase64 ou imageUrl requis pour le type image.",
                )

            image = resize_for_model(image)
            elapsed_ms = int((time.time() - start) * 1000)
            result = detect(image, runner, body.prompt, body.lang, body.requestId, elapsed_ms)
            result.processingTimeMs = int((time.time() - start) * 1000)
            return result

        elif body.type == "video":
            if not body.videoBase64:
                raise HTTPException(
                    status_code=422,
                    detail="videoBase64 requis pour le type video.",
                )

            frames = video_service.extract_frames(body.videoBase64, n_frames=5)
            if not frames:
                raise HTTPException(status_code=422, detail="Impossible d'extraire des frames.")

            frame_responses: List[ProcessResponse] = []
            for frame in frames:
                frame = resize_for_model(frame)
                resp = detect(frame, runner, body.prompt, body.lang, body.requestId)
                frame_responses.append(resp)

            aggregated = _aggregate_video_responses(frame_responses)
            aggregated.processingTimeMs = int((time.time() - start) * 1000)
            return aggregated

        elif body.type == "prompt":
            # Traitement d'un prompt textuel seul : image blanche de 100x100.
            blank_image = Image.new("RGB", (100, 100), "white")
            elapsed_ms = int((time.time() - start) * 1000)
            result = detect(blank_image, runner, body.prompt, body.lang, body.requestId, elapsed_ms)
            result.processingTimeMs = int((time.time() - start) * 1000)
            return result

        else:
            raise HTTPException(status_code=422, detail=f"Type inconnu : {body.type}.")

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Erreur lors du traitement de la requête {body.requestId} : {exc}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur.") from exc
