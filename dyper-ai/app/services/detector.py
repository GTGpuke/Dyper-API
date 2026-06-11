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


def detect(
    image: Image.Image,
    runner: YoloRunner,
    prompt: str | None,
    lang: str,
    request_id: str,
    processing_time_ms: int = 0,
    precomputed: Any | None = None,
) -> ProcessResponse:
    """Exécute le pipeline complet de détection sur une image PIL.

    Enchaîne l'inférence YOLO, l'extraction des objets, l'inférence de scène (localisée),
    les couleurs dominantes et la génération de description. Si `precomputed` est fourni
    (résultats YOLO déjà calculés, ex. tracking vidéo), l'inférence n'est pas relancée.
    """
    results = precomputed if precomputed is not None else runner.predict(image)
    objects = extract_objects(results)

    # Inférence de la scène (label localisé selon la langue) puis compte rendu enrichi
    # (composition spatiale via les dimensions de l'image, couleurs nommées).
    scene = scene_service.infer_scene(objects, lang)
    colors = get_dominant_colors(image, n=3)
    description_text = desc_service.generate(
        objects, scene, prompt, lang, colors=colors, image_size=image.size
    )
    tags = sorted({obj.label for obj in objects})

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
        model=runner.model_name,
        processingTimeMs=processing_time_ms,
    )
