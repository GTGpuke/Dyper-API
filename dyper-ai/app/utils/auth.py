"""Dépendance FastAPI pour l'authentification par clé interne."""

from fastapi import Header, HTTPException
from app.config import settings


def verify_internal_key(x_internal_key: str = Header(...)) -> None:
    """Vérifie que le header X-Internal-Key correspond à la clé configurée.

    Lève une HTTPException 401 si la clé est absente ou incorrecte.
    """
    if x_internal_key != settings.AI_INTERNAL_KEY:
        raise HTTPException(status_code=401, detail="Clé interne invalide.")
