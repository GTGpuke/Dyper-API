"""Point d'entrée principal du service dyper-ai — chargement du modèle YOLO au démarrage."""

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

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

    # Préchauffage : la 1re détection à vocabulaire ouvert encode le vocabulaire via CLIP — opération
    # lourde et SYNCHRONE qui, à froid, bloque le worker plusieurs dizaines de secondes (timeout de la
    # passerelle sur le 1er appel réel). On paie ce coût ici, au démarrage, pour que la 1re requête
    # utilisateur soit déjà chaude. Best-effort : un échec ne bloque jamais le service.
    try:
        from PIL import Image as _Image

        _warm = _Image.new("RGB", (640, 480), (127, 127, 127))
        runner.predict(_warm)
        if world is not None:
            world.detect_classes(_warm, ["person", "car", "dog"])
        logger.info("Préchauffage des modèles terminé (YOLO + vocabulaire ouvert).")
    except Exception as exc:
        logger.warning(f"Préchauffage ignoré (non bloquant) : {exc}")

    yield
    logger.info("Arrêt du service dyper-ai.")


app = FastAPI(title="dyper-ai", version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Traçabilité de bout en bout : réutilise l'identifiant X-Request-Id fourni par la passerelle
    (ou en génère un), puis le renvoie dans la réponse pour corréler les journaux entre services."""
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response


app.include_router(process.router)
app.include_router(moderate.router)
app.include_router(thumbnail.router)
app.include_router(health.router)
