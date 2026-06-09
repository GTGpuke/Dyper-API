"""Logger structuré en JSON avec timestamp ISO pour le service dyper-ai.

Le niveau de log est piloté par la variable d'environnement `LOG_LEVEL` (défaut : INFO).
La lecture se fait directement depuis l'environnement (et non via `app.config`) afin de
découpler la journalisation de la validation de configuration.
"""

import json
import logging
import os
from datetime import UTC, datetime

_LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()


class JsonFormatter(logging.Formatter):
    """Formateur de logs produisant une sortie JSON structurée avec timestamp ISO."""

    def format(self, record: logging.LogRecord) -> str:
        """Formate l'entrée de log en dictionnaire JSON sérialisé."""
        log_entry = {
            "timestamp": datetime.now(UTC).isoformat(),
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
        logger.setLevel(getattr(logging, _LOG_LEVEL, logging.INFO))
        # Évite la double émission via le logger racine.
        logger.propagate = False
    return logger
