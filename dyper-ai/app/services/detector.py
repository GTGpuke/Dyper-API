"""Orchestration du pipeline complet de détection : YOLO → scène → description → réponse."""

from typing import List, Optional

from PIL import Image

from app.schemas.response import BoundingBox, DetectedObject, ProcessResponse, Visualization
from app.services import description as desc_service
from app.services import scene as scene_service
from app.services.yolo_runner import YoloRunner
from app.utils.image import get_dominant_colors


def detect(
    image: Image.Image,
    runner: YoloRunner,
    prompt: Optional[str],
    lang: str,
    request_id: str,
    processing_time_ms: int = 0,
) -> ProcessResponse:
    """Exécute le pipeline complet de détection sur une image PIL.

    Enchaîne l'inférence YOLO, l'extraction des objets, l'inférence de scène,
    les couleurs dominantes et la génération de description.
    """
    # Lancement de l'inférence YOLO.
    results = runner.predict(image)

    objects: List[DetectedObject] = []

    if results.boxes is not None and len(results.boxes) > 0:
        boxes_xyxy = results.boxes.xyxy.tolist()
        confs = results.boxes.conf.tolist()
        cls_indices = results.boxes.cls.tolist()
        names: dict = results.names

        for i, (xyxy, conf, cls_idx) in enumerate(zip(boxes_xyxy, confs, cls_indices)):
            x1, y1, x2, y2 = xyxy
            label = names[int(cls_idx)]
            bbox = BoundingBox(x=x1, y=y1, w=x2 - x1, h=y2 - y1)
            objects.append(
                DetectedObject(label=label, confidence=round(float(conf), 4), boundingBox=bbox)
            )

    # Inférence de la scène à partir des objets détectés.
    scene = scene_service.infer_scene(objects)

    # Extraction des couleurs dominantes de l'image.
    colors = get_dominant_colors(image, n=3)

    # Génération de la description textuelle.
    description_text = desc_service.generate(objects, scene, prompt, lang)

    # Extraction des tags uniques à partir des labels détectés.
    tags = list(set(obj.label for obj in objects))

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
