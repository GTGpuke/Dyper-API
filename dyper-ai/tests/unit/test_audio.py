"""Tests unitaires du service audio : extraction, transcription et reconnaissance musicale."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.services import audio as audio_service
from app.services.audio import (
    analyze_audio,
    build_ffmpeg_command,
    extract_audio,
    recognize_music_file,
    transcribe_file,
)


@pytest.mark.unit
class TestExtraction:
    """Tests de l'extraction audio par ffmpeg."""

    def test_commande_ffmpeg_mono_16khz(self):
        """Vérifie la commande d'extraction : sans vidéo, mono, 16 kHz, AAC."""
        command = build_ffmpeg_command("/bin/ffmpeg", "/tmp/video.mp4", "/tmp/audio.m4a")
        assert command[0] == "/bin/ffmpeg"
        assert "-vn" in command
        assert command[command.index("-ac") + 1] == "1"
        assert command[command.index("-ar") + 1] == "16000"
        assert "-t" not in command
        assert command[-1] == "/tmp/audio.m4a"

    def test_commande_ffmpeg_extrait_limite(self):
        """Vérifie la limite de durée (extrait court pour le fingerprinting musical)."""
        command = build_ffmpeg_command(
            "/bin/ffmpeg", "/tmp/video.mp4", "/tmp/audio.m4a", max_seconds=30
        )
        assert command[command.index("-t") + 1] == "30"

    def test_extraction_echec_ffmpeg_retourne_none(self):
        """Vérifie le repli None quand ffmpeg échoue (vidéo sans piste audio)."""
        failed = MagicMock(returncode=1)
        with (
            patch("app.services.audio.subprocess.run", return_value=failed),
            patch("imageio_ffmpeg.get_ffmpeg_exe", return_value="/bin/ffmpeg"),
        ):
            assert extract_audio("/tmp/video.mp4") is None

    def test_extraction_taille_excessive_retourne_none(self):
        """Vérifie le repli None quand l'audio extrait dépasse la limite des APIs."""
        ok = MagicMock(returncode=0)
        with (
            patch("app.services.audio.subprocess.run", return_value=ok),
            patch("imageio_ffmpeg.get_ffmpeg_exe", return_value="/bin/ffmpeg"),
            patch("app.services.audio.os.path.exists", return_value=True),
            patch("app.services.audio.os.path.getsize", return_value=30 * 1024 * 1024),
            patch("app.services.audio.os.remove"),
        ):
            assert extract_audio("/tmp/video.mp4") is None


@pytest.mark.unit
class TestTranscription:
    """Tests de la transcription Whisper horodatée."""

    async def test_sans_cle_retourne_none(self):
        """Vérifie que la transcription est désactivée sans clé Groq (défaut des tests)."""
        assert await transcribe_file("/tmp/audio.m4a") == (None, None)

    async def test_transcription_reussie_avec_tranches(self):
        """Vérifie le chemin nominal : texte nettoyé + tranches horodatées parsées."""
        transcription = MagicMock(
            text="  Bonjour à tous.  ",
            segments=[
                {"start": 0.0, "end": 2.5, "text": " Bonjour "},
                {"start": 2.5, "end": 5.0, "text": "à tous."},
                {"start": 5.0, "end": 6.0, "text": "   "},  # Tranche vide : ignorée.
            ],
        )
        client = MagicMock()
        client.audio.transcriptions.create = AsyncMock(return_value=transcription)

        with (
            patch.object(audio_service.settings, "GROQ_API_KEY", "test-key"),
            patch.object(audio_service, "_get_client", return_value=client),
            patch("builtins.open", MagicMock()),
        ):
            text, segments = await transcribe_file("/tmp/audio.m4a")

        assert text == "Bonjour à tous."
        assert segments is not None
        assert len(segments) == 2
        assert segments[0].start == 0.0
        assert segments[0].text == "Bonjour"
        # Le format verbose est bien demandé à l'API.
        assert (
            client.audio.transcriptions.create.call_args.kwargs["response_format"] == "verbose_json"
        )

    async def test_transcription_sans_tranches(self):
        """Vérifie le repli texte seul quand la réponse n'expose pas de segments."""
        transcription = MagicMock(text="Bonjour.", segments=None)
        client = MagicMock()
        client.audio.transcriptions.create = AsyncMock(return_value=transcription)

        with (
            patch.object(audio_service.settings, "GROQ_API_KEY", "test-key"),
            patch.object(audio_service, "_get_client", return_value=client),
            patch("builtins.open", MagicMock()),
        ):
            assert await transcribe_file("/tmp/audio.m4a") == ("Bonjour.", None)

    async def test_echec_api_retourne_none(self):
        """Vérifie le repli (None, None) lorsque l'API Whisper échoue."""
        client = MagicMock()
        client.audio.transcriptions.create = AsyncMock(side_effect=RuntimeError("panne"))

        with (
            patch.object(audio_service.settings, "GROQ_API_KEY", "test-key"),
            patch.object(audio_service, "_get_client", return_value=client),
            patch("builtins.open", MagicMock()),
        ):
            assert await transcribe_file("/tmp/audio.m4a") == (None, None)


@pytest.mark.unit
class TestReconnaissanceMusicale:
    """Tests du fingerprinting AudD."""

    async def test_sans_jeton_retourne_none(self):
        """Vérifie que la reconnaissance est désactivée sans jeton AudD (défaut des tests)."""
        assert await recognize_music_file("/tmp/audio.m4a") is None

    async def test_reconnaissance_reussie(self):
        """Vérifie le chemin nominal : artiste, titre et album extraits de la réponse AudD."""
        response = MagicMock()
        response.json.return_value = {
            "status": "success",
            "result": {"artist": "Daft Punk", "title": "Around the World", "album": "Homework"},
        }
        http_client = MagicMock()
        http_client.post = AsyncMock(return_value=response)
        http_client.__aenter__ = AsyncMock(return_value=http_client)
        http_client.__aexit__ = AsyncMock(return_value=False)

        with (
            patch.object(audio_service.settings, "AUDD_API_TOKEN", "test-token"),
            patch("app.services.audio.httpx.AsyncClient", return_value=http_client),
            patch("builtins.open", MagicMock()),
        ):
            music = await recognize_music_file("/tmp/audio.m4a")

        assert music is not None
        assert music.artist == "Daft Punk"
        assert music.title == "Around the World"
        assert music.album == "Homework"

    async def test_musique_non_identifiee_retourne_none(self):
        """Vérifie le repli None quand AudD ne reconnaît rien (result null)."""
        response = MagicMock()
        response.json.return_value = {"status": "success", "result": None}
        http_client = MagicMock()
        http_client.post = AsyncMock(return_value=response)
        http_client.__aenter__ = AsyncMock(return_value=http_client)
        http_client.__aexit__ = AsyncMock(return_value=False)

        with (
            patch.object(audio_service.settings, "AUDD_API_TOKEN", "test-token"),
            patch("app.services.audio.httpx.AsyncClient", return_value=http_client),
            patch("builtins.open", MagicMock()),
        ):
            assert await recognize_music_file("/tmp/audio.m4a") is None

    async def test_echec_api_retourne_none(self):
        """Vérifie le repli None lorsque l'API AudD échoue."""
        http_client = MagicMock()
        http_client.post = AsyncMock(side_effect=RuntimeError("panne"))
        http_client.__aenter__ = AsyncMock(return_value=http_client)
        http_client.__aexit__ = AsyncMock(return_value=False)

        with (
            patch.object(audio_service.settings, "AUDD_API_TOKEN", "test-token"),
            patch("app.services.audio.httpx.AsyncClient", return_value=http_client),
            patch("builtins.open", MagicMock()),
        ):
            assert await recognize_music_file("/tmp/audio.m4a") is None


@pytest.mark.unit
class TestAnalyzeAudio:
    """Tests de l'orchestration complète (transcription + musique en parallèle)."""

    async def test_sans_aucune_cle_retourne_triple_none(self):
        """Vérifie le court-circuit complet quand ni Groq ni AudD ne sont configurés."""
        assert await analyze_audio("/tmp/video.mp4") == (None, None, None)

    async def test_orchestration_parallele(self):
        """Vérifie l'extraction double (complète + extrait) et le nettoyage final."""
        with (
            patch.object(audio_service.settings, "GROQ_API_KEY", "test-key"),
            patch.object(audio_service.settings, "AUDD_API_TOKEN", "test-token"),
            patch.object(
                audio_service, "extract_audio", side_effect=["/tmp/full.m4a", "/tmp/court.m4a"]
            ) as extract_mock,
            patch.object(
                audio_service, "transcribe_file", new=AsyncMock(return_value=("Bonjour.", None))
            ),
            patch.object(audio_service, "recognize_music_file", new=AsyncMock(return_value=None)),
            patch.object(audio_service, "_cleanup") as cleanup_mock,
        ):
            transcript, segments, music = await analyze_audio("/tmp/video.mp4")

        assert transcript == "Bonjour."
        assert segments is None
        assert music is None
        # Deux extractions (piste complète + extrait court) et nettoyage des deux fichiers.
        assert extract_mock.call_count == 2
        assert cleanup_mock.call_count == 2
