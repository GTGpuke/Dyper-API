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
    # Variante du modèle : "yolo26x" (extra-large), seule variante prise en charge en production.
    YOLO_MODEL_VARIANT: str = "yolo26x"
    # Dossier contenant les fichiers .pt (relatif à dyper-ai/). Non commité.
    YOLO_MODEL_PATH: str = "../model"
    # Score de confiance minimum pour retenir une détection (0.0 → 1.0).
    YOLO_CONF_THRESHOLD: float = 0.25

    # --- Traitement ---
    # Dimension maximale (px) avant inférence (plus haut = petits objets mieux détectés, plus lent).
    IMAGE_MAX_DIM: int = 1536
    # Timeout (secondes) pour le téléchargement d'une image fournie par URL.
    IMAGE_FETCH_TIMEOUT: float = 10.0

    # --- Vidéo ---
    # Durée maximale autorisée pour une vidéo (secondes). Au-delà, l'analyse est refusée.
    VIDEO_MAX_DURATION_S: float = 300.0
    # Cadence d'échantillonnage cible des images analysées (images par seconde). Élevée à dessein :
    # plus elle est haute, plus le suivi vidéo est précis (un faible déplacement entre deux frames
    # permet au tracker d'associer correctement les objets ; sinon une même voiture change
    # d'identité à chaque frame). Relevable selon le matériel d'hébergement.
    VIDEO_SAMPLE_FPS: float = 10.0
    # Plafond du nombre de frames traitées par vidéo. À 10 img/s, la cadence pleine tient jusqu'à
    # 180 s ; au-delà, l'échantillonnage se raréfie automatiquement. Relever pour garder la pleine
    # cadence sur des vidéos plus longues (analyse plus longue, sans incidence sur la précision par frame).
    VIDEO_MAX_FRAMES: int = 1800
    # Plafond du vocabulaire vision (global) transmis à la détection vidéo.
    VIDEO_VOCAB_MAX: int = 40
    # Plancher de détection de coupure de plan (0–1) : une coupure est un PIC d'écart entre frames
    # (couleur + structure) au-dessus de ce plancher ET de la base de mouvement locale (adaptatif).
    # Au-delà, le suivi est réinitialisé (pas de persistance entre clips). 0 = désactivé ;
    # baisser = plus sensible aux coupures, monter = moins.
    SCENE_CUT_THRESHOLD: float = 0.20
    # Durée CUMULÉE de détection (secondes) qu'une piste doit atteindre pour être affichée et comptée
    # (vidéo). On compte le nombre TOTAL de frames où la piste apparaît (sans exiger qu'elles soient
    # consécutives), converti en secondes via la cadence réelle d'échantillonnage. Un critère de
    # présence CONTINUE éliminait à tort les objets du vocabulaire ouvert (mug, cup, glasses, suit…),
    # détectés par intermittence mais bien présents ; le cumul préserve cette richesse. En deçà du
    # seuil, la piste est jugée fugace (hallucination ou label parasite d'une/deux frames isolées) et
    # ses détections sont écartées des boîtes par frame ET de l'agrégat. Une piste présente sur TOUTE
    # la séquence (clip très court) n'est jamais filtrée. Plancher absolu de 2 frames (un flicker d'une
    # seule frame est toujours écarté). 0 = filtre désactivé. Baisser (ex. 0,3) pour encore plus de
    # richesse, monter pour être plus strict. Repère : 0,3 s ≈ 3 frames à 10 img/s (parité avec
    # l'ancien filtre) ; 0,5 s ≈ 5 frames ; 0,7 s ≈ 7 frames (plus strict, écarte plus de détections brèves).
    VIDEO_MIN_TRACK_SECONDS: float = 0.5

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
    # Timeouts (secondes) des appels vision et audio.
    VISION_TIMEOUT_S: float = 45.0
    AUDIO_TIMEOUT_S: float = 60.0

    # --- Reconnaissance musicale (AudD, optionnelle) ---
    # Jeton API AudD (https://audd.io) : identifie la bande-son des vidéos (type Shazam).
    # Vide : reconnaissance désactivée, sans erreur.
    AUDD_API_TOKEN: str = ""
    # Durée (secondes) de chaque extrait audio envoyé pour le fingerprinting.
    MUSIC_EXCERPT_S: int = 30
    # Intervalle (secondes) entre deux extraits sondés (reconnaissance musicale multi-titres).
    MUSIC_PROBE_INTERVAL_S: int = 60
    # Nombre maximal d'extraits sondés — et donc de titres distincts — par vidéo.
    MUSIC_MAX_TRACKS: int = 8

    # --- Modération de contenu (feed public, Groq, optionnelle) ---
    # Modèles Groq de modération (réutilisent le modèle vision multimodal par défaut).
    MODERATION_IMAGE_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    MODERATION_TEXT_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    # Timeout (secondes) des appels de modération.
    MODERATION_TIMEOUT_S: float = 30.0

    # --- Chronologie ---
    # Nombre maximal d'échantillons manquants comblés entre deux détections d'une même piste
    # (lissage anti-scintillement de la chronologie, ≈ 0,4 s à 10 img/s).
    TIMELINE_GAP_FILL: int = 4

    # --- Détection à vocabulaire ouvert (YOLO-World, fusionné avec COCO) ---
    # Variante du modèle YOLO-World : "yolov8x-worldv2" (max, défaut) ; abaisser à
    # "yolov8l-worldv2" ou "yolov8m-worldv2" si la VRAM est limitée.
    WORLD_MODEL_VARIANT: str = "yolov8x-worldv2"
    # Nombre maximal d'éléments (classes texte) issus de la vision, transmis au détecteur.
    WORLD_MAX_CLASSES: int = 20
    # Résolution d'inférence (px) du détecteur à vocabulaire ouvert — 1280 = analyse fine
    # des petits objets (abaisser à 640 sur GPU à faible VRAM).
    WORLD_IMGSZ: int = 1280

    # --- Fusion COCO + vocabulaire ouvert (image & vidéo) ---
    # Confiance minimale des détections COCO (seuil d'inférence) — affichées et, en vidéo, suivies.
    DISPLAY_MIN_CONFIDENCE: float = 0.55
    # Confiance minimale de YOLO-World : calibrée plus bas car les scores CLIP sont structurellement
    # faibles — un seuil élevé masquerait quasiment toute la couverture ouverte.
    WORLD_DISPLAY_MIN_CONFIDENCE: float = 0.30
    # Seuil IoU de fusion : au-delà, deux boîtes désignent le même objet (COCO prioritaire).
    MERGE_IOU_THRESHOLD: float = 0.55
    # Plafond du vocabulaire ouvert transmis à YOLO-World (éléments vision + base LVIS éventuelle).
    OPEN_VOCAB_MAX: int = 1500
    # Inclure la base LVIS (~1200 classes) dans le vocabulaire ouvert des VIDÉOS. Vrai par défaut :
    # en vidéo, le suivi écarte les détections fugaces (cf. VIDEO_MIN_TRACK_SECONDS), donc la large
    # couverture LVIS retrouve les objets que la vision n'a pas listés SANS laisser passer les
    # hallucinations brèves de classes obscures (un mur vu comme « birdbath », un cou comme
    # « necklace »…). Mettre à Faux pour limiter les vidéos aux seuls éléments décrits.
    OPEN_VOCAB_INCLUDE_BASE: bool = True
    # IDEM pour les IMAGES (réglage SÉPARÉ — n'affecte que la branche image). Vrai = World cherche
    # aussi la base LVIS, pas seulement les éléments décrits par la vision → couverture bien plus
    # large (objets que la vision n'a pas nommés). Contrepartie : pas de filtre temporel en image
    # pour départager une hallucination — une classe obscure très confiante (≥ DISPLAY_MIN_CONFIDENCE)
    # peut apparaître cochée ; sous le seuil, elle reste affichée mais décochée par défaut. Mettre à
    # Faux pour revenir au comportement « ancré sur la vision uniquement ».
    IMAGE_OPEN_VOCAB_INCLUDE_BASE: bool = True
    # Marge de bordure (fraction de la dimension) : en vidéo, les détections dont la boîte touche
    # le bord du cadre (objet tronqué, à moitié hors champ → label ambigu, ex. un camion entrant
    # vu comme une voiture) sont écartées avant le suivi. 0 = désactivé ; régler selon le cadrage.
    DETECTION_BORDER_MARGIN: float = 0.0

    # --- Suivi multi-objets sur mesure (vidéo, cf. app/services/tracker.py) ---
    # Pondérations du coût d'association : mouvement (distance à la position prédite), recouvrement
    # (IoU) et apparence (couleur moyenne). Le mouvement prime, l'apparence départage.
    TRACK_W_MOTION: float = 1.0
    TRACK_W_IOU: float = 0.5
    TRACK_W_APPEARANCE: float = 0.4
    # Pondération de l'écart de TAILLE (échelle de la boîte) entre la détection et la piste. Empêche
    # qu'un objet grossissant brutalement (zoom, objet surgissant au premier plan) « vole » la piste
    # d'une cible plus petite avec laquelle il se recouvre : leurs dimensions diffèrent trop. Un vrai
    # changement d'échelle est progressif (faible écart par frame) et reste donc apparié ; seul un
    # saut d'échelle brutal est pénalisé. Mis volontairement assez ferme pour être discriminant.
    TRACK_W_SIZE: float = 0.6
    # Bande de tolérance du coût de taille : ratio de dimension (petite/grande) au-DESSUS duquel
    # l'écart est jugé normal (aucune pénalité). 0,5 = on tolère jusqu'à un facteur 2 entre deux frames
    # (jitter des petites boîtes, ex. lunettes) ; en deçà, la pénalité monte pour les sauts brutaux.
    TRACK_SIZE_TOLERANCE: float = 0.5
    # Pénalité ajoutée au coût quand les classes diffèrent (souple : n'interdit pas, décourage).
    TRACK_LABEL_PENALTY: float = 0.3
    # Coût maximal pour associer une détection à une piste ; au-delà, une nouvelle piste est créée.
    TRACK_MAX_COST: float = 1.0
    # Nombre de frames sans détection avant d'oublier une piste (tolérance occlusions/manques).
    TRACK_MAX_AGE: int = 30

    # --- Analyse de vidéos par URL (YouTube / Twitch) ---
    # Liste blanche des hôtes autorisés (séparés par des virgules) — aucun autre téléchargement.
    VIDEO_URL_ALLOWED_HOSTS: str = "youtube.com,youtu.be,twitch.tv"
    # Résolution plafonnée du téléchargement (1080p : plus de détail pour les petits objets).
    VIDEO_URL_MAX_HEIGHT: int = 1080
    # Taille maximale du fichier téléchargé (octets).
    VIDEO_URL_MAX_BYTES: int = 200 * 1024 * 1024

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
