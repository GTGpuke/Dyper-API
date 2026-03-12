"""Chargement et exécution du modèle YOLO pour l'inférence locale."""

from PIL import Image
from ultralytics import YOLO

from app.config import settings


class YoloRunner:
    """Encapsule le cycle de vie du modèle YOLO : chargement et prédiction."""

    def __init__(self) -> None:
        """Initialise le runner sans charger le modèle en mémoire."""
        self.model: YOLO | None = None
        self.model_name: str = settings.YOLO_MODEL_VARIANT

    def load(self) -> None:
        """Charge le modèle YOLO en mémoire depuis le chemin configuré."""
        path = f"{settings.YOLO_MODEL_PATH}/{self.model_name}.pt"
        self.model = YOLO(path)

    def predict(self, image: Image.Image, conf_threshold: float = 0.25):
        """Lance l'inférence YOLO sur une image PIL et retourne les résultats bruts."""
        results = self.model.predict(source=image, conf=conf_threshold, verbose=False)
        return results[0]
