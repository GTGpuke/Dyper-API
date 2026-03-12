"""Point d'entrée principal du service dyper-ai — chargement du modèle YOLO au démarrage."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routes import health, process
from app.services.yolo_runner import YoloRunner
from app.utils.logger import get_logger

logger = get_logger(__name__)

runner: YoloRunner = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gère le cycle de vie de l'application : chargement et libération du modèle YOLO."""
    global runner
    runner = YoloRunner()
    runner.load()
    app.state.runner = runner
    logger.info(f"Modèle {runner.model_name} chargé avec succès.")
    yield
    logger.info("Arrêt du service dyper-ai.")


app = FastAPI(title="dyper-ai", version="1.0.0", lifespan=lifespan)
app.include_router(process.router)
app.include_router(health.router)
