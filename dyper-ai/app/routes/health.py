"""Route de santé du service dyper-ai."""

from fastapi import APIRouter, Request

from app.config import settings

router = APIRouter()


@router.get("/health")
def health_check(request: Request) -> dict:
    """Retourne l'état du service, la variante de modèle active et si le modèle est chargé."""
    runner = getattr(request.app.state, "runner", None)
    model_loaded = runner is not None and getattr(runner, "model", None) is not None
    return {
        "status": "ok",
        "model": settings.YOLO_MODEL_VARIANT,
        "modelLoaded": model_loaded,
    }
