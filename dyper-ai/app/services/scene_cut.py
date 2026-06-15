"""Détection de coupures de plan (cuts) pour réinitialiser le suivi entre clips d'une vidéo.

Une compilation (clips collés bout à bout) ne doit pas voir les identités d'objets « persister »
d'un plan à l'autre — sinon un chat du clip A est relié à un autre chat du clip B. Chaque frame
est comparée à la précédente par une signature **couleur (histogramme HSV) + structure (vignette
grise)** ; une coupure est un **pic** d'écart, au-dessus d'un plancher ET de la base de mouvement
locale (seuil ADAPTATIF : un plan agité a une base plus haute, donc seul un vrai saut déclenche —
ce qui évite les faux positifs sur le mouvement et rate beaucoup moins de coupures qu'un seuil fixe).
L'appelant réinitialise le tracker à chaque coupure.
"""

from collections import deque

import numpy as np
from PIL import Image

# Histogramme couleur : teinte × saturation (chromaticité, indépendante de la luminosité).
_HUE_BINS = 16
_SAT_BINS = 4
# Vignette grise (structure / luminosité) : complète la couleur (coupures à teinte voisine).
_THUMB_SIZE = 16
# Une coupure est un pic au-dessus de la moyenne récente + K écarts-types (anti faux positifs).
_SPIKE_K = 3.0
_BASELINE_MIN = 5
_BASELINE_WINDOW = 16


def frame_signature(image: Image.Image) -> tuple[np.ndarray, np.ndarray]:
    """Signature d'une frame : histogramme couleur HSV (teinte × saturation) + vignette grise."""
    rgb = image.convert("RGB")
    hsv = np.asarray(rgb.convert("HSV"), dtype=np.float32)
    hist, _, _ = np.histogram2d(
        hsv[:, :, 0].ravel(),
        hsv[:, :, 1].ravel(),
        bins=[_HUE_BINS, _SAT_BINS],
        range=[[0.0, 256.0], [0.0, 256.0]],
    )
    total = float(hist.sum())
    if total > 0:
        color = (hist.ravel() / total).astype(np.float32)
    else:
        color = hist.ravel().astype(np.float32)
    gray = rgb.convert("L").resize((_THUMB_SIZE, _THUMB_SIZE))
    thumb = np.asarray(gray, dtype=np.float32).ravel() / 255.0
    return color, thumb


def scene_change_score(a: tuple[np.ndarray, np.ndarray], b: tuple[np.ndarray, np.ndarray]) -> float:
    """Écart combiné entre deux signatures ∈ [0, 1] : max(distance couleur, distance structure)."""
    color_dist = float(np.abs(a[0] - b[0]).sum()) / 2.0
    thumb_dist = float(np.abs(a[1] - b[1]).mean())
    return max(color_dist, thumb_dist)


class SceneCutDetector:
    """Détecte les coupures de plan via un pic d'écart adaptatif (mémorise frame + base récente)."""

    def __init__(self, floor: float) -> None:
        """`floor` ∈ ]0, 1] : écart minimal d'une coupure ; ≤ 0 désactive la détection."""
        self._floor = floor
        self._prev: tuple[np.ndarray, np.ndarray] | None = None
        self._recent: deque[float] = deque(maxlen=_BASELINE_WINDOW)

    def is_cut(self, image: Image.Image) -> bool:
        """Vrai si la frame marque une coupure (pic au-dessus du plancher ET de la base locale)."""
        if self._floor <= 0:
            return False
        sig = frame_signature(image)
        if self._prev is None:
            self._prev = sig
            return False
        score = scene_change_score(self._prev, sig)
        self._prev = sig
        threshold = self._floor
        if len(self._recent) >= _BASELINE_MIN:
            base = np.array(self._recent, dtype=np.float32)
            threshold = max(self._floor, float(base.mean()) + _SPIKE_K * float(base.std()))
        if score > threshold:
            self._recent.clear()  # Nouveau plan : on repart sur une base de mouvement vierge.
            return True
        self._recent.append(score)
        return False
