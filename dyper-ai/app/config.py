"""Configuration centralisée du service dyper-ai via variables d'environnement.

Charge les variables depuis le fichier `.env` ou l'environnement. Crash immédiatement
au démarrage si une variable requise (`AI_INTERNAL_KEY`) est manquante, afin d'éviter
toute erreur silencieuse en cours d'exécution (même philosophie « fail-fast » que la
passerelle dyper-api).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Paramètres de configuration du service dyper-ai."""

    # --- Serveur ---
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    # --- Sécurité ---
    # Clé interne partagée avec la passerelle dyper-api (header X-Internal-Key). Obligatoire.
    AI_INTERNAL_KEY: str

    # --- Modèle YOLO local ---
    # Variante du modèle : "yolo26l" (large, par défaut) ou "yolo26x" (extra-large, précis).
    YOLO_MODEL_VARIANT: str = "yolo26l"
    # Dossier contenant les fichiers .pt (relatif à dyper-ai/). Non commité.
    YOLO_MODEL_PATH: str = "../model"
    # Score de confiance minimum pour retenir une détection (0.0 → 1.0).
    YOLO_CONF_THRESHOLD: float = 0.25

    # --- Traitement ---
    # Dimension maximale (px) à laquelle les images sont réduites avant inférence.
    IMAGE_MAX_DIM: int = 1280
    # Timeout (secondes) pour le téléchargement d'une image fournie par URL.
    IMAGE_FETCH_TIMEOUT: float = 10.0
    # Nombre de frames extraites d'une vidéo pour l'analyse.
    VIDEO_FRAMES: int = 5

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
