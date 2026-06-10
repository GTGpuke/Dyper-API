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

    def test_extract_frames_retourne_images_et_timestamps(self):
        """Vérifie que extract_frames retourne des couples (image PIL, horodatage croissant)."""
        # 50 frames à 10 fps → durée 5 s → ~5 images à la cadence 1/s.
        frames = _run_extract(_mock_cap(total_frames=50, fps=10))
        assert isinstance(frames, list)
        assert all(isinstance(f, Image.Image) for f, _t in frames)
        assert len(frames) == 5
        timestamps = [t for _f, t in frames]
        assert timestamps == sorted(timestamps)
        assert timestamps[0] == 0.0
        # Dernière position ≈ frame 49 à 10 fps → 4.9 s.
        assert timestamps[-1] == 4.9

    def test_extract_frames_vide_si_pas_de_frames(self):
        """Vérifie que extract_frames retourne une liste vide si la vidéo n'a pas de frames."""
        frames = _run_extract(_mock_cap(total_frames=0, fps=30))
        assert frames == []

    def test_cadence_un_par_seconde_video_courte(self):
        """Vérifie ~1 image/seconde sur une vidéo courte (40 frames à 10 fps → 4 s → 4 images)."""
        frames = _run_extract(_mock_cap(total_frames=40, fps=10))
        assert len(frames) == 4

    def test_plafond_60_images_video_longue(self):
        """Vérifie le plafond : 3000 frames à 30 fps → 100 s → cadence 100 mais plafonné à 60."""
        frames = _run_extract(_mock_cap(total_frames=3000, fps=30))
        assert len(frames) == 60

    def test_duree_trop_longue_leve_erreur(self):
        """Vérifie qu'une vidéo > 5 min lève VideoTooLongError (9000 frames à 25 fps = 360 s)."""
        from app.services.video import VideoTooLongError

        with pytest.raises(VideoTooLongError):
            _run_extract(_mock_cap(total_frames=9000, fps=25))

    def test_fps_invalide_utilise_repli(self):
        """Vérifie le repli FPS (fps<=0) : 50 frames, repli 25 fps → 2 s → 2 images."""
        frames = _run_extract(_mock_cap(total_frames=50, fps=0))
        assert len(frames) == 2

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
        with patch("app.services.video.extract_frames", return_value=fake_frames):
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
        # Chronologie : une entrée par frame, horodatages préservés, labels du mock (person).
        assert [e["t"] for e in data["timeline"]] == [0.0, 1.0, 2.0]
        assert data["timeline"][0]["labels"] == ["person"]
        # Miniature décodable + dimensions de la première frame analysée.
        assert base64.b64decode(data["thumbnailBase64"])
        assert (data["sourceWidth"], data["sourceHeight"]) == (60, 40)

    def test_route_refuse_video_trop_longue(self, client):
        """Vérifie que la route /process renvoie 422 quand la vidéo est trop longue."""
        from app.services.video import VideoTooLongError

        with patch(
            "app.services.video.extract_frames",
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
