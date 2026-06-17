"""Chargement et exécution du modèle YOLO pour l'inférence locale.

L'import de `ultralytics` (et donc de PyTorch) est différé dans `load()` afin que l'import
de ce module reste léger — les tests unitaires peuvent ainsi mocker le runner sans installer
la stack ML complète.
"""

from pathlib import Path
from typing import Any

from PIL import Image

from app.config import settings


class YoloRunner:
    """Encapsule le cycle de vie du modèle YOLO : chargement et prédiction."""

    def __init__(self) -> None:
        """Initialise le runner sans charger le modèle en mémoire."""
        self.model: Any | None = None
        self.model_name: str = settings.YOLO_MODEL_VARIANT

    def load(self) -> None:
        """Charge le modèle YOLO en mémoire depuis le chemin configuré.

        Lève `RuntimeError` avec un message explicite si le fichier `.pt` est introuvable,
        plutôt qu'une erreur cryptique d'ultralytics.
        """
        path = Path(settings.YOLO_MODEL_PATH) / f"{self.model_name}.pt"
        if not path.is_file():
            raise RuntimeError(
                f"Modèle YOLO introuvable : {path.resolve()}. "
                f"Placez le fichier « {self.model_name}.pt » dans le dossier "
                f"« {settings.YOLO_MODEL_PATH} » (voir le README de dyper-ai). "
                "Variante attendue : yolo26x.pt."
            )

        # Import différé : évite de charger PyTorch tant que le modèle n'est pas requis.
        from ultralytics import YOLO

        self.model = YOLO(str(path))

    def predict(self, image: Image.Image, conf_threshold: float | None = None) -> Any:
        """Lance l'inférence YOLO sur une image PIL et retourne les résultats bruts.

        Utilise le seuil de confiance configuré (`YOLO_CONF_THRESHOLD`) si aucun n'est fourni.
        """
        if self.model is None:
            raise RuntimeError("Le modèle YOLO n'est pas chargé. Appelez load() au démarrage.")
        conf = settings.YOLO_CONF_THRESHOLD if conf_threshold is None else conf_threshold
        results = self.model.predict(source=image, conf=conf, verbose=False)
        return results[0]
