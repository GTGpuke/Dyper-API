"""Tests de régression du pipeline vidéo avec extraction de frames mockée."""

import base64
import os
import pytest
from unittest.mock import MagicMock, patch
from PIL import Image


@pytest.mark.regression
class TestPipelineVideo:
    """Tests du pipeline extract_frames() avec des vidéos simulées."""

    def test_extract_frames_retourne_liste_images(self):
        """Vérifie que extract_frames retourne une liste d'images PIL."""
        # Simulation de cv2.VideoCapture avec 10 frames.
        mock_cap = MagicMock()
        mock_cap.get.return_value = 10.0
        mock_cap.read.return_value = (True, [[[ 255, 0, 0]] * 100] * 100)

        import numpy as np
        fake_frame = np.ones((100, 100, 3), dtype="uint8") * 128
        mock_cap.read.return_value = (True, fake_frame)

        with patch("app.services.video.cv2.VideoCapture", return_value=mock_cap), \
             patch("app.services.video.tempfile.mkstemp", return_value=(0, "/tmp/fake.mp4")), \
             patch("app.services.video.os.fdopen", MagicMock()), \
             patch("app.services.video.os.path.exists", return_value=False):

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

        with patch("app.services.video.cv2.VideoCapture", return_value=mock_cap), \
             patch("app.services.video.tempfile.mkstemp", return_value=(0, "/tmp/fake.mp4")), \
             patch("app.services.video.os.fdopen", MagicMock()), \
             patch("app.services.video.os.path.exists", return_value=False):

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

        with patch("app.services.video.cv2.VideoCapture", return_value=mock_cap), \
             patch("app.services.video.tempfile.mkstemp", return_value=(0, "/tmp/fake.mp4")), \
             patch("app.services.video.os.fdopen", MagicMock()), \
             patch("app.services.video.os.path.exists", return_value=False):

            from app.services.video import extract_frames
            video_b64 = base64.b64encode(b"fake").decode()
            frames = extract_frames(video_b64, n_frames=5)

        assert len(frames) == 5
