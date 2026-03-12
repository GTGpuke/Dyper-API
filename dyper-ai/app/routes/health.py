"""Route de santé du service dyper-ai."""

from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
def health_check() -> dict:
    """Retourne l'état du service et le nom du modèle YOLO actif."""
    return {"status": "ok", "model": settings.YOLO_MODEL_VARIANT}
