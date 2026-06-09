"""Point d'entrée principal du service dyper-ai — chargement du modèle YOLO au démarrage."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.routes import health, process
from app.services.yolo_runner import YoloRunner
from app.utils.logger import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Charge le modèle YOLO au démarrage (une seule fois) et le libère à l'arrêt.

    En cas d'échec de chargement (modèle absent), l'erreur est journalisée puis propagée
    afin d'empêcher le démarrage d'un service non fonctionnel (fail-fast).
    """
    runner = YoloRunner()
    try:
        runner.load()
    except Exception as exc:
        logger.error(f"Échec du chargement du modèle YOLO : {exc}")
        raise

    app.state.runner = runner
    logger.info(
        f"Modèle {runner.model_name} chargé avec succès "
        f"(seuil de confiance = {settings.YOLO_CONF_THRESHOLD})."
    )
    yield
    logger.info("Arrêt du service dyper-ai.")


app = FastAPI(title="dyper-ai", version="1.0.0", lifespan=lifespan)
app.include_router(process.router)
app.include_router(health.router)
