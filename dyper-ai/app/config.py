"""Configuration centralisée du service dyper-ai via variables d'environnement."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Paramètres de configuration chargés depuis le fichier .env ou l'environnement."""

    PORT: int = 8000
    AI_INTERNAL_KEY: str = ""
    YOLO_MODEL_VARIANT: str = "yolo26l"
    YOLO_MODEL_PATH: str = "../model"
    YOLO_CONF_THRESHOLD: float = 0.25

    class Config:
        env_file = ".env"


settings = Settings()
