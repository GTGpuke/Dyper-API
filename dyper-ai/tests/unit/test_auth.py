"""Tests unitaires pour la vérification de la clé d'authentification interne."""

import pytest
from fastapi import HTTPException
from unittest.mock import patch

from app.utils.auth import verify_internal_key


@pytest.mark.unit
class TestVerifyInternalKey:
    """Tests de la dépendance verify_internal_key."""

    def test_cle_valide_ne_leve_pas_exception(self):
        """Vérifie qu'une clé valide ne lève aucune exception."""
        with patch("app.utils.auth.settings") as mock_settings:
            mock_settings.AI_INTERNAL_KEY = "mysecretkey"
            # Ne doit pas lever d'exception.
            result = verify_internal_key(x_internal_key="mysecretkey")
            assert result is None

    def test_cle_invalide_leve_401(self):
        """Vérifie qu'une clé incorrecte lève une HTTPException 401."""
        with patch("app.utils.auth.settings") as mock_settings:
            mock_settings.AI_INTERNAL_KEY = "mysecretkey"
            with pytest.raises(HTTPException) as exc_info:
                verify_internal_key(x_internal_key="wrongkey")
            assert exc_info.value.status_code == 401

    def test_cle_vide_leve_401(self):
        """Vérifie qu'une clé vide lève une HTTPException 401 si la configuration attend une clé."""
        with patch("app.utils.auth.settings") as mock_settings:
            mock_settings.AI_INTERNAL_KEY = "mysecretkey"
            with pytest.raises(HTTPException) as exc_info:
                verify_internal_key(x_internal_key="")
            assert exc_info.value.status_code == 401

    def test_detail_erreur_401(self):
        """Vérifie que le message d'erreur 401 est explicite."""
        with patch("app.utils.auth.settings") as mock_settings:
            mock_settings.AI_INTERNAL_KEY = "mysecretkey"
            with pytest.raises(HTTPException) as exc_info:
                verify_internal_key(x_internal_key="badkey")
            assert "invalide" in exc_info.value.detail.lower()
