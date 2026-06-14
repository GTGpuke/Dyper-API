"""Tests de régression du pipeline vidéo avec extraction de frames mockée."""

import base64
from unittest.mock import MagicMock, patch

import cv2
import numpy as np
import pytest
from PIL import Image


def _mock_cap(total_frames: float, fps: float) -> MagicMock:
    """Construit un faux cv2.VideoCapture exposant un nombre de frames et un FPS donnés."""
    cap = MagicMock()

    def _get(prop: int) -> float:
        if prop == cv2.CAP_PROP_FRAME_COUNT:
            return float(total_frames)
        if prop == cv2.CAP_PROP_FPS:
            return float(fps)
        return 0.0

    cap.get.side_effect = _get
    cap.read.return_value = (True, np.ones((50, 50, 3), dtype="uint8") * 128)
    return cap


def _run_extract(cap: MagicMock):
    """Exécute extract_frames avec les accès disque/temp mockés autour d'un cap donné."""
    with (
        patch("app.services.video.cv2.VideoCapture", return_value=cap),
        patch("app.services.video.tempfile.mkstemp", return_value=(0, "/tmp/fake.mp4")),
        patch("app.services.video.os.fdopen", MagicMock()),
        patch("app.services.video.os.path.exists", return_value=False),
    ):
        from app.services.video import extract_frames

        return extract_frames(base64.b64encode(b"fake_video_content").decode())


@pytest.mark.regression
class TestPipelineVideo:
    """Tests du pipeline extract_frames() avec des vidéos simulées."""

    def test_extract_frames_retourne_images_et_timestamps(self, monkeypatch):
        """Vérifie que extract_frames retourne des couples (image PIL, horodatage croissant)."""
        from app.config import settings

        # Cadence fixée pour tester la logique d'échantillonnage indépendamment du défaut.
        monkeypatch.setattr(settings, "VIDEO_SAMPLE_FPS", 3.0)
        # 50 frames à 10 fps → durée 5 s → 15 images à la cadence 3/s.
        frames = _run_extract(_mock_cap(total_frames=50, fps=10))
        assert isinstance(frames, list)
        assert all(isinstance(f, Image.Image) for f, _t in frames)
        assert len(frames) == 15
        timestamps = [t for _f, t in frames]
        assert timestamps == sorted(timestamps)
        assert timestamps[0] == 0.0
        # Dernière position ≈ frame 49 à 10 fps → 4.9 s.
        assert timestamps[-1] == 4.9

    def test_extract_frames_vide_si_pas_de_frames(self):
        """Vérifie que extract_frames retourne une liste vide si la vidéo n'a pas de frames."""
        frames = _run_extract(_mock_cap(total_frames=0, fps=30))
        assert frames == []

    def test_cadence_echantillonnage_video_courte(self, monkeypatch):
        """Vérifie la cadence d'échantillonnage (fixée à 3/s : 40 frames à 10 fps → 4 s → 12 images)."""
        from app.config import settings

        monkeypatch.setattr(settings, "VIDEO_SAMPLE_FPS", 3.0)
        frames = _run_extract(_mock_cap(total_frames=40, fps=10))
        assert len(frames) == 12

    def test_plafond_frames_sur_duree_maximale(self, monkeypatch):
        """Vérifie qu'une cible d'images supérieure au plafond est ramenée à VIDEO_MAX_FRAMES.

        À 30 img/s sur 300 s la cible serait 9000 images ; le plafond la borne (au-delà,
        l'échantillonnage se raréfie automatiquement).
        """
        from app.config import settings

        monkeypatch.setattr(settings, "VIDEO_SAMPLE_FPS", 30.0)
        frames = _run_extract(_mock_cap(total_frames=9000, fps=30))
        assert len(frames) == settings.VIDEO_MAX_FRAMES

    def test_duree_trop_longue_leve_erreur(self):
        """Vérifie qu'une vidéo > 5 min lève VideoTooLongError (9000 frames à 25 fps = 360 s)."""
        from app.services.video import VideoTooLongError

        with pytest.raises(VideoTooLongError):
            _run_extract(_mock_cap(total_frames=9000, fps=25))

    def test_fps_invalide_utilise_repli(self, monkeypatch):
        """Vérifie le repli FPS (fps<=0) : 50 frames, repli 25 fps → 2 s → 6 images (cadence 3/s)."""
        from app.config import settings

        monkeypatch.setattr(settings, "VIDEO_SAMPLE_FPS", 3.0)
        frames = _run_extract(_mock_cap(total_frames=50, fps=0))
        assert len(frames) == 6

    def test_base64_invalide_leve_value_error(self):
        """Vérifie qu'un base64 invalide lève une ValueError (mappée en 422 par la route)."""
        from app.services.video import extract_frames

        with pytest.raises(ValueError):
            extract_frames("!!!pas-du-base64!!!")

    def test_route_video_retourne_timeline_et_miniature(self, client):
        """Vérifie que la route /process construit la chronologie et la miniature vidéo."""
        import numpy as np

        fake_frames = [
            (Image.fromarray(np.ones((40, 60, 3), dtype="uint8") * 100), 0.0),
            (Image.fromarray(np.ones((40, 60, 3), dtype="uint8") * 150), 1.0),
            (Image.fromarray(np.ones((40, 60, 3), dtype="uint8") * 200), 2.0),
        ]
        with patch("app.services.video.extract_frames_from_path", return_value=fake_frames):
            res = client.post(
                "/process",
                json={
                    "requestId": "vid-timeline",
                    "type": "video",
                    "videoBase64": base64.b64encode(b"x").decode(),
                },
            )
        assert res.status_code == 200
        data = res.json()
        # Chronologie : une entrée par frame, horodatages préservés. COCO et le vocabulaire
        # ouvert détectent tous deux « person » (fusionnés sous un même label dédupliqué).
        assert [e["t"] for e in data["timeline"]] == [0.0, 1.0, 2.0]
        assert "person" in data["timeline"][0]["labels"]
        # Détections par frame (lecteur annoté) : trackId stable issu du tracking mocké.
        assert len(data["frames"]) == 3
        assert data["frames"][0]["objects"][0]["trackId"] == 1
        assert data["frames"][0]["objects"][0]["boundingBox"] is not None
        # Miniature décodable + dimensions de la première frame analysée.
        assert base64.b64decode(data["thumbnailBase64"])
        assert (data["sourceWidth"], data["sourceHeight"]) == (60, 40)
        # Sans clés (défaut des tests) : ni transcription ni musique.
        assert data["audioTranscript"] is None
        assert data["music"] == []

    def test_route_video_decrire_puis_ancrer_avec_audio_et_musique(self, client):
        """Vérifie le pipeline vidéo inversé : audio → vision → tracking à vocabulaire ouvert."""
        from unittest.mock import AsyncMock

        import numpy as np
        from app.schemas.response import MusicInfo, TranscriptSegment
        from app.services.vision_llm import VisionAnalysis

        fake_frames = [(Image.fromarray(np.ones((40, 60, 3), dtype="uint8") * 100), 0.0)]
        music = MusicInfo(artist="Daft Punk", title="Around the World", album=None)
        vision = VisionAnalysis(
            description="Compte rendu vision détaillé de la vidéo.",
            elements=["elephant", "rock"],
            scene_label="enclos de zoo",
            indoor=False,
        )
        with (
            patch("app.services.video.extract_frames_from_path", return_value=fake_frames),
            patch(
                "app.routes.process.audio_service.analyze_audio",
                new=AsyncMock(
                    return_value=(
                        "Bonjour à tous.",
                        [TranscriptSegment(start=0.0, end=2.0, text="Bonjour à tous.")],
                        [music],
                    )
                ),
            ),
            patch(
                "app.routes.process.vision_llm.describe_and_extract",
                new=AsyncMock(return_value=vision),
            ) as vision_mock,
        ):
            res = client.post(
                "/process",
                json={
                    "requestId": "vid-vision",
                    "type": "video",
                    "videoBase64": base64.b64encode(b"x").decode(),
                },
            )
        assert res.status_code == 200
        data = res.json()
        assert data["description"] == "Compte rendu vision détaillé de la vidéo."
        assert data["audioTranscript"] == "Bonjour à tous."
        assert data["music"] == [
            {"artist": "Daft Punk", "title": "Around the World", "album": None}
        ]
        # L'audio est analysé AVANT la vision et lui est transmis (transcript + musique).
        assert vision_mock.call_args.kwargs["music_summary"] == "Daft Punk — Around the World"
        assert vision_mock.call_args.kwargs["transcript"] == "Bonjour à tous."
        # Transcription horodatée présente dans la réponse.
        assert data["transcriptSegments"] == [{"start": 0.0, "end": 2.0, "text": "Bonjour à tous."}]
        # Fusion COCO + vocabulaire ouvert : COCO (« person », piste stable) et le détecteur
        # à vocabulaire ouvert (« elephant », premier élément de la vision) coexistent.
        labels = [obj["label"] for obj in data["visualization"]["objects"]]
        assert "elephant" in labels
        assert data["frames"][0]["objects"][0]["trackId"] == 1
        assert data["visualization"]["scene"]["label"] == "enclos de zoo"

    def test_route_video_synthese_description_finale(self, client):
        """Vérifie que la description finale est la synthèse Groq de toutes les sources."""
        from unittest.mock import AsyncMock, patch

        import numpy as np
        from app.services.vision_llm import VisionAnalysis

        fake_frames = [(Image.fromarray(np.ones((40, 60, 3), dtype="uint8") * 100), 0.0)]
        vision = VisionAnalysis(description="Compte rendu visuel global.", elements=["car"])
        with (
            patch("app.services.video.extract_frames_from_path", return_value=fake_frames),
            patch(
                "app.routes.process.vision_llm.describe_and_extract",
                new=AsyncMock(return_value=vision),
            ),
            patch(
                "app.routes.process.vision_llm.synthesize_description",
                new=AsyncMock(return_value="Description finale synthétisée."),
            ) as synth_mock,
        ):
            res = client.post(
                "/process",
                json={
                    "requestId": "vid-synth",
                    "type": "video",
                    "videoBase64": base64.b64encode(b"x").decode(),
                },
            )
        assert res.status_code == 200
        data = res.json()
        # La synthèse multi-sources remplace le compte rendu visuel brut.
        assert data["description"] == "Description finale synthétisée."
        # La référence prioritaire transmise à la synthèse est le compte rendu visuel global.
        assert synth_mock.call_args.args[0] == "Compte rendu visuel global."

    def test_route_video_vocabulaire_vision_globale(self, client, mock_world):
        """Vérifie que le vocabulaire ouvert vient des éléments de la vision globale (sans chapitres)."""
        from unittest.mock import AsyncMock

        import numpy as np
        from app.services.vision_llm import VisionAnalysis

        fake_frames = [(Image.fromarray(np.ones((40, 60, 3), dtype="uint8") * 100), 0.0)]
        vision = VisionAnalysis(description="Compte rendu global.", elements=["elephant", "man"])
        with (
            patch("app.services.video.extract_frames_from_path", return_value=fake_frames),
            patch(
                "app.routes.process.vision_llm.describe_and_extract",
                new=AsyncMock(return_value=vision),
            ),
        ):
            res = client.post(
                "/process",
                json={
                    "requestId": "vid-vocab",
                    "type": "video",
                    "videoBase64": base64.b64encode(b"x").decode(),
                },
            )
        assert res.status_code == 200
        data = res.json()
        # Plus de chapitres dans la réponse (fonctionnalité retirée).
        assert "chapters" not in data
        # Vocabulaire ouvert = éléments de la vision globale en tête, suivis de la base étendue.
        called_vocab = mock_world.detect_classes.call_args.args[1]
        assert called_vocab[:2] == ["elephant", "man"]

    def test_route_video_par_url_plateforme(self, client, tmp_path):
        """Vérifie l'analyse par URL : téléchargement mocké, écho videoBase64 pour stockage."""
        from unittest.mock import AsyncMock

        import numpy as np

        # Faux fichier vidéo réel sur disque (le pipeline le lit puis le supprime).
        fake_video = tmp_path / "clip.mp4"
        fake_video.write_bytes(b"fake-mp4-from-youtube")
        fake_frames = [(Image.fromarray(np.ones((40, 60, 3), dtype="uint8") * 100), 0.0)]

        with (
            patch(
                "app.services.video_download.download_video_from_url",
                new=AsyncMock(return_value=str(fake_video)),
            ),
            patch("app.services.video.extract_frames_from_path", return_value=fake_frames),
        ):
            res = client.post(
                "/process",
                json={
                    "requestId": "vid-url",
                    "type": "video",
                    "videoUrl": "https://youtu.be/abc123",
                },
            )
        assert res.status_code == 200
        data = res.json()
        # La vidéo téléchargée est renvoyée en base64 (stockage côté passerelle).
        assert base64.b64decode(data["videoBase64"]) == b"fake-mp4-from-youtube"
        assert data["visualization"]["objects"][0]["label"] == "person"
        # Le fichier temporaire a été supprimé après traitement.
        assert not fake_video.exists()

    def test_route_video_url_hors_liste_blanche(self, client):
        """Vérifie qu'une URL hors liste blanche est refusée avec un message clair (422)."""
        res = client.post(
            "/process",
            json={
                "requestId": "vid-url-refusee",
                "type": "video",
                "videoUrl": "https://example.com/video.mp4",
            },
        )
        assert res.status_code == 422
        assert "non autorisée" in res.json()["detail"]

    def test_route_refuse_video_trop_longue(self, client):
        """Vérifie que la route /process renvoie 422 quand la vidéo est trop longue."""
        from app.services.video import VideoTooLongError

        with patch(
            "app.services.video.extract_frames_from_path",
            side_effect=VideoTooLongError(
                "La vidéo dépasse la durée maximale autorisée de 5 minutes."
            ),
        ):
            res = client.post(
                "/process",
                json={
                    "requestId": "vid-too-long",
                    "type": "video",
                    "videoBase64": base64.b64encode(b"x").decode(),
                },
            )
        assert res.status_code == 422
        assert "5 minutes" in res.json()["detail"]


@pytest.mark.regression
class TestAggregateVideoResponses:
    """Tests de l'agrégation des réponses multi-frames."""

    def _resp(self, label: str, conf: float, scene_label: str, request_id: str = "vid-1"):
        """Construit une ProcessResponse minimale pour les tests d'agrégation."""
        from app.schemas.response import DetectedObject, ProcessResponse, Scene, Visualization

        return ProcessResponse(
            requestId=request_id,
            description="desc",
            visualization=Visualization(
                objects=[DetectedObject(label=label, confidence=conf)],
                scene=Scene(label=scene_label, confidence=0.8, indoor=None),
                colors=["#000000"],
                text=[],
                tags=[label],
            ),
            model="yolo26l",
            processingTimeMs=10,
        )

    def test_agregation_conserve_meilleure_confiance(self):
        """Vérifie que la fusion garde la meilleure confiance par label et somme les temps."""
        from app.routes.process import _aggregate_video_responses

        responses = [
            self._resp("car", 0.6, "rue / circulation urbaine"),
            self._resp("car", 0.9, "rue / circulation urbaine"),
            self._resp("car", 0.7, "scène générale"),
        ]
        result = _aggregate_video_responses(responses, "fr")

        assert len(result.visualization.objects) == 1
        assert result.visualization.objects[0].confidence == 0.9
        # La scène la plus fréquente (2 occurrences) doit l'emporter.
        assert result.visualization.scene.label == "rue / circulation urbaine"
        assert result.processingTimeMs == 30

    def test_agregation_langue_anglaise(self):
        """Vérifie que la description agrégée respecte la langue demandée."""
        from app.routes.process import _aggregate_video_responses

        responses = [self._resp("car", 0.8, "street / urban traffic")]
        result = _aggregate_video_responses(responses, "en")
        assert "The image shows" in result.description
