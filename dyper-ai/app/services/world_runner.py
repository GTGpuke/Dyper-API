"""Détecteur à vocabulaire ouvert (YOLO-World) — boxe des concepts arbitraires exprimés en texte.

Pièce maîtresse du pipeline « décrire puis ancrer » : le modèle vision liste les éléments
réellement visibles, et ce runner les localise précisément (le vocabulaire est défini à la
volée par requête). Utilise le GPU automatiquement quand torch-CUDA est présent, avec bascule
CPU en cas de mémoire insuffisante (laptops à VRAM limitée).
"""

from pathlib import Path
from typing import Any

from PIL import Image

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class WorldRunner:
    """Encapsule YOLO-World : chargement, vocabulaire dynamique et détection."""

    def __init__(self) -> None:
        """Initialise le runner sans charger le modèle en mémoire."""
        self.model: Any | None = None
        self.model_name: str = settings.WORLD_MODEL_VARIANT
        # Dernier vocabulaire encodé : évite de réencoder le texte (CLIP) à chaque frame.
        self._current_classes: list[str] | None = None

    def load(self) -> None:
        """Charge YOLO-World : fichier local s'il existe, sinon téléchargement automatique."""
        # Import différé : évite de charger PyTorch tant que le modèle n'est pas requis.
        from ultralytics import YOLOWorld

        local_path = Path(settings.YOLO_MODEL_PATH) / f"{self.model_name}.pt"
        source = str(local_path) if local_path.is_file() else f"{self.model_name}.pt"
        self.model = YOLOWorld(source)

    def is_ready(self) -> bool:
        """Indique si le détecteur à vocabulaire ouvert est chargé et utilisable."""
        return self.model is not None

    def _sync_clip_device(self) -> None:
        """Aligne le device du wrapper CLIP en cache sur celui de ses poids réels.

        Contournement d'un bug ultralytics : après le premier passage du modèle sur CUDA,
        le wrapper CLIP (mis en cache par set_classes) conserve `device=cpu` — les tokens
        du vocabulaire suivant partent alors sur CPU contre des poids sur CUDA (crash
        « index is on cpu »). Idem en sens inverse après une bascule CPU (VRAM saturée).
        """
        assert self.model is not None  # Garanti par l'appelant.
        clip_wrapper = getattr(self.model.model, "clip_model", None)
        if clip_wrapper is not None and hasattr(clip_wrapper, "model"):
            clip_wrapper.device = next(clip_wrapper.model.parameters()).device

    def _set_vocabulary(self, classes: list[str]) -> None:
        """Définit le vocabulaire de détection (réencodé uniquement s'il change)."""
        if classes != self._current_classes:
            assert self.model is not None  # Garanti par l'appelant (is_ready).
            self._sync_clip_device()
            self.model.set_classes(classes)
            self._current_classes = classes

    def detect_classes(self, image: Image.Image, classes: list[str]) -> Any:
        """Détecte les concepts demandés sur une image (prédiction simple, sans suivi).

        Le suivi d'identité en vidéo est porté par COCO (cf. app/routes/process.py) ; ce
        détecteur n'apporte que la couverture du vocabulaire ouvert, fusionnée spatialement.
        En cas de mémoire GPU insuffisante, bascule automatiquement sur CPU et réessaie (journalisé).
        """
        if self.model is None:
            raise RuntimeError(
                "Le modèle YOLO-World n'est pas chargé. Appelez load() au démarrage."
            )
        self._set_vocabulary(classes)

        try:
            return self._run(image)
        except RuntimeError as exc:
            if "out of memory" not in str(exc).lower():
                raise
            # VRAM insuffisante (GPU à faible mémoire sur grande image) : bascule CPU et réessai.
            logger.warning("Mémoire GPU insuffisante pour YOLO-World : bascule sur CPU.")
            import torch

            torch.cuda.empty_cache()
            self.model.to("cpu")
            return self._run(image)

    def _run(self, image: Image.Image) -> Any:
        """Exécute la prédiction et retourne les résultats bruts.

        La résolution d'inférence est forcée à `WORLD_IMGSZ` (1280 par défaut) : la valeur
        implicite d'ultralytics (640) dégraderait la détection des petits objets.
        """
        assert self.model is not None  # Garanti par detect_classes.
        conf = settings.WORLD_DISPLAY_MIN_CONFIDENCE
        imgsz = settings.WORLD_IMGSZ
        results = self.model.predict(source=image, conf=conf, imgsz=imgsz, verbose=False)
        return results[0]
