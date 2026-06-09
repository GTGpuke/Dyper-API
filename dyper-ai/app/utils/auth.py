"""Dépendance FastAPI pour l'authentification par clé interne (header X-Internal-Key)."""

import hmac

from fastapi import Header, HTTPException

from app.config import settings


def verify_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    """Vérifie que le header X-Internal-Key correspond à la clé configurée.

    La comparaison est effectuée en temps constant (`hmac.compare_digest`) pour éviter
    les attaques temporelles. Lève une HTTPException 401 si la clé est absente ou invalide.
    """
    expected = settings.AI_INTERNAL_KEY
    if not x_internal_key or not hmac.compare_digest(x_internal_key, expected):
        raise HTTPException(status_code=401, detail="Clé interne invalide ou manquante.")
