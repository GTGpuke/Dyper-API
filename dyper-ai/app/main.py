"""Point d'entrée principal du service dyper-ai — chargement du modèle YOLO au démarrage."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.routes import health, moderate, process, thumbnail
from app.services.world_runner import WorldRunner
from app.services.yolo_runner import YoloRunner
from app.utils.logger import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Charge les modèles au démarrage (une seule fois) et les libère à l'arrêt.

    YOLO (COCO) est obligatoire : un échec de chargement empêche le démarrage (fail-fast).
    YOLO-World (vocabulaire ouvert) est best-effort : indisponible → repli COCO, jamais bloquant.
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

    # Détecteur à vocabulaire ouvert (téléchargement automatique au premier démarrage).
    world_runner = WorldRunner()
    world: WorldRunner | None
    try:
        world_runner.load()
        logger.info(f"Modèle {world_runner.model_name} (vocabulaire ouvert) chargé avec succès.")
        world = world_runner
    except Exception as exc:
        logger.warning(f"YOLO-World indisponible (repli sur les classes COCO) : {exc}")
        world = None
    app.state.world = world

    yield
    logger.info("Arrêt du service dyper-ai.")


app = FastAPI(title="dyper-ai", version="1.0.0", lifespan=lifespan)
app.include_router(process.router)
app.include_router(moderate.router)
app.include_router(thumbnail.router)
app.include_router(health.router)
