"""Tests unitaires du téléchargement contrôlé de vidéos par URL (YouTube / Twitch)."""

from unittest.mock import patch

import pytest
from app.services import video_download
from app.services.video_download import VideoUrlError, download_video_from_url, is_allowed_url


@pytest.mark.unit
class TestListeBlanche:
    """Tests de la liste blanche d'hôtes."""

    @pytest.mark.parametrize(
        "url",
        [
            "https://www.youtube.com/watch?v=abc123",
            "https://youtu.be/abc123",
            "https://youtube.com/shorts/abc123",
            "https://clips.twitch.tv/UnClip",
            "https://www.twitch.tv/streamer/clip/UnClip",
            "https://www.twitch.tv/videos/123456",
        ],
    )
    def test_urls_autorisees(self, url):
        """Vérifie que les URLs YouTube et Twitch usuelles sont acceptées."""
        assert is_allowed_url(url) is True

    @pytest.mark.parametrize(
        "url",
        [
            "https://example.com/video.mp4",
            "https://evil-youtube.com/watch?v=abc",
            "ftp://youtube.com/watch?v=abc",
            "https://youtube.com.evil.com/watch",
            "pas-une-url",
        ],
    )
    def test_urls_refusees(self, url):
        """Vérifie que tout hôte hors liste blanche est refusé (anti-abus)."""
        assert is_allowed_url(url) is False


@pytest.mark.unit
class TestTelechargement:
    """Tests de l'orchestration de téléchargement."""

    async def test_url_hors_liste_leve_erreur(self):
        """Vérifie le rejet immédiat d'une URL hors liste blanche."""
        with pytest.raises(VideoUrlError, match="non autorisée"):
            await download_video_from_url("https://example.com/video.mp4")

    async def test_duree_excessive_refusee_avant_telechargement(self):
        """Vérifie qu'une vidéo > 5 minutes est refusée sur les métadonnées seules."""
        with (
            patch.object(video_download, "_fetch_duration_sync", return_value=400.0),
            patch.object(video_download, "_download_sync") as download_mock,
        ):
            with pytest.raises(VideoUrlError, match="5 minutes"):
                await download_video_from_url("https://youtu.be/abc123")
        download_mock.assert_not_called()

    async def test_telechargement_nominal(self):
        """Vérifie le chemin nominal : durée acceptée puis téléchargement."""
        with (
            patch.object(video_download, "_fetch_duration_sync", return_value=60.0),
            patch.object(video_download, "_download_sync", return_value="/tmp/clip.mp4"),
        ):
            assert await download_video_from_url("https://youtu.be/abc123") == "/tmp/clip.mp4"

    async def test_echec_metadonnees_message_francais(self):
        """Vérifie le message d'erreur français quand les métadonnées sont inaccessibles."""
        with patch.object(
            video_download, "_fetch_duration_sync", side_effect=RuntimeError("réseau")
        ):
            with pytest.raises(VideoUrlError, match="Impossible de télécharger"):
                await download_video_from_url("https://youtu.be/abc123")
