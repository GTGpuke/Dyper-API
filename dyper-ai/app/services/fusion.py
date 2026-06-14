"""Fusion des détections COCO (précises sur 80 classes) et YOLO-World (vocabulaire ouvert).

Déduplication SPATIALE (IoU) et non par label : COCO « person » et World « man » désignent le
même objet. On conserve toutes les boîtes primaires (COCO, plus précises) et on n'ajoute une
boîte secondaire (World) que si elle ne recouvre aucune boîte déjà retenue → une seule boîte
par objet, COCO prioritaire, World comblant la couverture.
"""

from app.schemas.response import BoundingBox, DetectedObject


def iou(a: BoundingBox, b: BoundingBox) -> float:
    """Intersection sur union de deux boîtes (coin supérieur gauche + largeur/hauteur)."""
    ax2, ay2 = a.x + a.w, a.y + a.h
    bx2, by2 = b.x + b.w, b.y + b.h
    inter_w = max(0.0, min(ax2, bx2) - max(a.x, b.x))
    inter_h = max(0.0, min(ay2, by2) - max(a.y, b.y))
    inter = inter_w * inter_h
    if inter <= 0.0:
        return 0.0
    union = a.w * a.h + b.w * b.h - inter
    return inter / union if union > 0.0 else 0.0


def merge_detections(
    primary: list[DetectedObject],
    secondary: list[DetectedObject],
    iou_threshold: float,
) -> list[DetectedObject]:
    """Fusionne deux jeux de détections en gardant une seule boîte par objet (primaire prioritaire).

    Toutes les boîtes `primary` sont conservées ; une boîte `secondary` n'est ajoutée que si elle
    ne recouvre (IoU ≥ `iou_threshold`) aucune boîte déjà retenue.
    """
    merged: list[DetectedObject] = list(primary)
    for candidate in secondary:
        if candidate.boundingBox is None:
            merged.append(candidate)
            continue
        overlaps = any(
            kept.boundingBox is not None
            and iou(kept.boundingBox, candidate.boundingBox) >= iou_threshold
            for kept in merged
        )
        if not overlaps:
            merged.append(candidate)
    return merged
