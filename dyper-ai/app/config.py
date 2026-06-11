"""Configuration centralisée du service dyper-ai via variables d'environnement.

Charge les variables depuis le fichier `.env` ou l'environnement. Crash immédiatement
au démarrage si une variable requise (`AI_INTERNAL_KEY`) est manquante, afin d'éviter
toute erreur silencieuse en cours d'exécution (même philosophie « fail-fast » que la
passerelle dyper-api).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Paramètres de configuration du service dyper-ai."""

    # --- Serveur ---
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    # --- Sécurité ---
    # Clé interne partagée avec la passerelle dyper-api (header X-Internal-Key). Obligatoire.
    AI_INTERNAL_KEY: str

    # --- Modèle YOLO local ---
    # Variante du modèle : "yolo26l" (large, par défaut) ou "yolo26x" (extra-large, précis).
    YOLO_MODEL_VARIANT: str = "yolo26l"
    # Dossier contenant les fichiers .pt (relatif à dyper-ai/). Non commité.
    YOLO_MODEL_PATH: str = "../model"
    # Score de confiance minimum pour retenir une détection (0.0 → 1.0).
    YOLO_CONF_THRESHOLD: float = 0.25

    # --- Traitement ---
    # Dimension maximale (px) à laquelle les images sont réduites avant inférence.
    IMAGE_MAX_DIM: int = 1280
    # Timeout (secondes) pour le téléchargement d'une image fournie par URL.
    IMAGE_FETCH_TIMEOUT: float = 10.0

    # --- Vidéo ---
    # Durée maximale autorisée pour une vidéo (secondes). Au-delà, l'analyse est refusée.
    VIDEO_MAX_DURATION_S: float = 300.0
    # Cadence d'échantillonnage cible des images analysées (images par seconde).
    VIDEO_SAMPLE_FPS: float = 3.0
    # Plafond d'images analysées — dimensionné pour que la cadence pleine tienne sur toute
    # la durée maximale autorisée (3 img/s × 300 s) : aucune vidéo admise n'est dégradée.
    VIDEO_MAX_FRAMES: int = 900
    # Durée (secondes) d'un chapitre d'analyse (vision par segment, alignée sur l'audio).
    VIDEO_SEGMENT_S: float = 20.0
    # Plafond de l'union des vocabulaires (global + segments) pour la détection vidéo.
    VIDEO_VOCAB_MAX: int = 40

    # --- Compréhension multimodale (Groq, optionnelle) ---
    # Clé API Groq : active la compréhension globale (vision LLM) et la transcription audio.
    # Vide : repli automatique sur la description template et pas d'audio (comportement local).
    GROQ_API_KEY: str = ""
    # Modèle vision-langage (multimodal) pour le compte rendu global.
    VISION_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    # Modèle de transcription audio (Whisper hébergé par Groq).
    WHISPER_MODEL: str = "whisper-large-v3-turbo"
    # Nombre maximal d'images clés envoyées au modèle vision pour une vidéo (maximum Groq).
    VISION_MAX_FRAMES: int = 5
    # Dimension maximale (px) des images envoyées au modèle vision (maîtrise des tokens).
    VISION_IMAGE_MAX_DIM: int = 768
    # Dimension réduite pour les appels par chapitre (nombreux : économie de tokens/minute).
    VISION_SEGMENT_IMAGE_MAX_DIM: int = 512
    # Timeouts (secondes) des appels vision et audio.
    VISION_TIMEOUT_S: float = 45.0
    AUDIO_TIMEOUT_S: float = 60.0

    # --- Reconnaissance musicale (AudD, optionnelle) ---
    # Jeton API AudD (https://audd.io) : identifie la bande-son des vidéos (type Shazam).
    # Vide : reconnaissance désactivée, sans erreur.
    AUDD_API_TOKEN: str = ""
    # Durée (secondes) de l'extrait audio envoyé pour le fingerprinting.
    MUSIC_EXCERPT_S: int = 30

    # --- Chronologie ---
    # Nombre maximal d'échantillons manquants comblés entre deux détections d'une même piste
    # (lissage anti-scintillement de la chronologie, ≈ 1,3 s à 3 img/s).
    TIMELINE_GAP_FILL: int = 4

    # --- Détection à vocabulaire ouvert (YOLO-World, guidée par la vision) ---
    # Variante du modèle YOLO-World : "yolov8x-worldv2" (max, défaut) ; abaisser à
    # "yolov8l-worldv2" ou "yolov8m-worldv2" si la VRAM est limitée (ex. RTX 3050).
    WORLD_MODEL_VARIANT: str = "yolov8x-worldv2"
    # Seuil de confiance du vocabulaire ouvert (score plus bas que les classes COCO figées).
    WORLD_CONF_THRESHOLD: float = 0.1
    # Nombre maximal d'éléments (classes texte) transmis au détecteur par analyse.
    WORLD_MAX_CLASSES: int = 20
    # Résolution d'inférence (px) du détecteur à vocabulaire ouvert — 1280 = analyse fine
    # des petits objets (abaisser à 640 sur GPU à VRAM limitée, ex. RTX 3050).
    WORLD_IMGSZ: int = 1280

    # --- Analyse de vidéos par URL (YouTube / Twitch) ---
    # Liste blanche des hôtes autorisés (séparés par des virgules) — aucun autre téléchargement.
    VIDEO_URL_ALLOWED_HOSTS: str = "youtube.com,youtu.be,twitch.tv"
    # Résolution plafonnée du téléchargement (720p : aligne la qualité sur l'inférence 1280).
    VIDEO_URL_MAX_HEIGHT: int = 720
    # Taille maximale du fichier téléchargé (octets).
    VIDEO_URL_MAX_BYTES: int = 100 * 1024 * 1024

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
