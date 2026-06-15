"""Orchestration du pipeline complet de détection : YOLO → scène → description → réponse."""

from typing import Any

from PIL import Image

from app.schemas.response import BoundingBox, DetectedObject, ProcessResponse, Visualization
from app.services import description as desc_service
from app.services import scene as scene_service
from app.services.yolo_runner import YoloRunner
from app.utils.image import get_dominant_colors


def extract_objects(results: Any) -> list[DetectedObject]:
    """Extrait les objets détectés des résultats YOLO bruts (trackId inclus si tracking)."""
    objects: list[DetectedObject] = []
    if results.boxes is not None and len(results.boxes) > 0:
        boxes_xyxy = results.boxes.xyxy.tolist()
        confs = results.boxes.conf.tolist()
        cls_indices = results.boxes.cls.tolist()
        # Identifiants de piste : présents uniquement en mode tracking (model.track).
        box_ids = getattr(results.boxes, "id", None)
        track_ids = box_ids.tolist() if box_ids is not None else None
        names: dict = results.names

        for index, (xyxy, conf, cls_idx) in enumerate(
            zip(boxes_xyxy, confs, cls_indices, strict=False)
        ):
            x1, y1, x2, y2 = xyxy
            label = names[int(cls_idx)]
            bbox = BoundingBox(x=x1, y=y1, w=x2 - x1, h=y2 - y1)
            objects.append(
                DetectedObject(
                    label=label,
                    confidence=round(float(conf), 4),
                    boundingBox=bbox,
                    trackId=int(track_ids[index]) if track_ids is not None else None,
                )
            )
    return objects


def build_response(
    objects: list[DetectedObject],
    image: Image.Image,
    prompt: str | None,
    lang: str,
    request_id: str,
    model: str,
    processing_time_ms: int = 0,
) -> ProcessResponse:
    """Construit la réponse à partir d'objets déjà détectés (scène, couleurs, compte rendu, tags).

    Séparé de `detect()` pour permettre la fusion : la passerelle peut combiner plusieurs
    détecteurs (COCO + vocabulaire ouvert) puis bâtir une seule réponse, avec son propre label.
    """
    # Inférence de la scène (label localisé selon la langue) puis compte rendu enrichi
    # (composition spatiale via les dimensions de l'image, couleurs nommées).
    # Compte rendu, scène et tags ne reposent que sur les détections prioritaires ; le vocabulaire
    # ouvert sous le seuil reste dans la visualisation (drapeau priority) mais demeure secondaire.
    priority_objects = [obj for obj in objects if obj.priority]
    scene = scene_service.infer_scene(priority_objects, lang)
    colors = get_dominant_colors(image, n=3)
    description_text = desc_service.generate(
        priority_objects, scene, prompt, lang, colors=colors, image_size=image.size
    )
    tags = sorted({obj.label for obj in priority_objects})

    visualization = Visualization(
        objects=objects,
        scene=scene,
        colors=colors,
        text=[],
        tags=tags,
    )

    return ProcessResponse(
        requestId=request_id,
        description=description_text,
        visualization=visualization,
        model=model,
        processingTimeMs=processing_time_ms,
    )


def detect(
    image: Image.Image,
    runner: YoloRunner,
    prompt: str | None,
    lang: str,
    request_id: str,
    processing_time_ms: int = 0,
) -> ProcessResponse:
    """Exécute le pipeline COCO complet sur une image PIL (inférence via `runner`)."""
    objects = extract_objects(runner.predict(image))
    return build_response(
        objects, image, prompt, lang, request_id, runner.model_name, processing_time_ms
    )
