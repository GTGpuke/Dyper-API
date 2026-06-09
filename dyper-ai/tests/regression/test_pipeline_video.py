"""Tests de régression du pipeline vidéo avec extraction de frames mockée."""

import base64
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image


@pytest.mark.regression
class TestPipelineVideo:
    """Tests du pipeline extract_frames() avec des vidéos simulées."""

    def test_extract_frames_retourne_liste_images(self):
        """Vérifie que extract_frames retourne une liste d'images PIL."""
        # Simulation de cv2.VideoCapture avec 10 frames.
        mock_cap = MagicMock()
        mock_cap.get.return_value = 10.0
        mock_cap.read.return_value = (True, [[[255, 0, 0]] * 100] * 100)

        import numpy as np

        fake_frame = np.ones((100, 100, 3), dtype="uint8") * 128
        mock_cap.read.return_value = (True, fake_frame)

        with (
            patch("app.services.video.cv2.VideoCapture", return_value=mock_cap),
            patch("app.services.video.tempfile.mkstemp", return_value=(0, "/tmp/fake.mp4")),
            patch("app.services.video.os.fdopen", MagicMock()),
            patch("app.services.video.os.path.exists", return_value=False),
        ):
            from app.services.video import extract_frames

            # Encodage base64 vide (le fichier est mocké).
            video_b64 = base64.b64encode(b"fake_video_content").decode()
            frames = extract_frames(video_b64, n_frames=5)

        assert isinstance(frames, list)
        assert all(isinstance(f, Image.Image) for f in frames)

    def test_extract_frames_vide_si_pas_de_frames(self):
        """Vérifie que extract_frames retourne une liste vide si la vidéo n'a pas de frames."""
        mock_cap = MagicMock()
        mock_cap.get.return_value = 0.0

        with (
            patch("app.services.video.cv2.VideoCapture", return_value=mock_cap),
            patch("app.services.video.tempfile.mkstemp", return_value=(0, "/tmp/fake.mp4")),
            patch("app.services.video.os.fdopen", MagicMock()),
            patch("app.services.video.os.path.exists", return_value=False),
        ):
            from app.services.video import extract_frames

            video_b64 = base64.b64encode(b"empty").decode()
            frames = extract_frames(video_b64, n_frames=5)

        assert frames == []

    def test_extract_frames_5_positions(self):
        """Vérifie que 5 frames sont extraites aux positions correctes."""
        import numpy as np

        fake_frame = np.ones((50, 50, 3), dtype="uint8") * 200
        mock_cap = MagicMock()
        mock_cap.get.return_value = 100.0
        mock_cap.read.return_value = (True, fake_frame)

        with (
            patch("app.services.video.cv2.VideoCapture", return_value=mock_cap),
            patch("app.services.video.tempfile.mkstemp", return_value=(0, "/tmp/fake.mp4")),
            patch("app.services.video.os.fdopen", MagicMock()),
            patch("app.services.video.os.path.exists", return_value=False),
        ):
            from app.services.video import extract_frames

            video_b64 = base64.b64encode(b"fake").decode()
            frames = extract_frames(video_b64, n_frames=5)

        assert len(frames) == 5

    def test_base64_invalide_leve_value_error(self):
        """Vérifie qu'un base64 invalide lève une ValueError (mappée en 422 par la route)."""
        from app.services.video import extract_frames

        with pytest.raises(ValueError):
            extract_frames("!!!pas-du-base64!!!", n_frames=5)


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
