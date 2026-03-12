"""Logger structuré en JSON avec timestamp ISO pour le service dyper-ai."""

import logging
import json
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    """Formateur de logs produisant une sortie JSON structurée avec timestamp ISO."""

    def format(self, record: logging.LogRecord) -> str:
        """Formate l'entrée de log en dictionnaire JSON sérialisé."""
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, ensure_ascii=False)


def get_logger(name: str) -> logging.Logger:
    """Crée et retourne un logger nommé avec le formateur JSON configuré."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger
