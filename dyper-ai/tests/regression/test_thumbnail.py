"""Tests de la route POST /thumbnail et du résolveur de miniature de plateforme."""

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.unit
class TestFetchThumbnailUrl:
    """Tests du résolveur de miniature (best-effort, liste blanche)."""

    async def test_url_hors_liste_blanche_retourne_none(self):
        """Vérifie qu'une URL hors liste blanche retourne None sans interroger yt-dlp."""
        from app.services.video_download import fetch_thumbnail_url

        assert await fetch_thumbnail_url("https://example.com/clip") is None


@pytest.mark.regression
class TestRouteThumbnail:
    """Tests de la route POST /thumbnail (résolution best-effort de la miniature)."""

    def test_thumbnail_retourne_url(self, client):
        """Vérifie que la route retourne l'URL de miniature résolue."""
        with patch(
            "app.routes.thumbnail.video_download.fetch_thumbnail_url",
            new=AsyncMock(return_value="https://img.youtube.com/vi/abc/hqdefault.jpg"),
        ):
            res = client.post("/thumbnail", json={"url": "https://youtu.be/abc"})
        assert res.status_code == 200
        assert res.json()["thumbnailUrl"] == "https://img.youtube.com/vi/abc/hqdefault.jpg"

    def test_thumbnail_indisponible_retourne_null(self, client):
        """Vérifie que la route retourne null quand aucune miniature n'est résolue."""
        with patch(
            "app.routes.thumbnail.video_download.fetch_thumbnail_url",
            new=AsyncMock(return_value=None),
        ):
            res = client.post("/thumbnail", json={"url": "https://www.twitch.tv/x/clip/y"})
        assert res.status_code == 200
        assert res.json()["thumbnailUrl"] is None
