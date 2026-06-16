"""Route principale POST /process du service dyper-ai."""

import base64
import math
import os
import time
from collections import Counter
from io import BytesIO
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from PIL import Image

from app.config import settings
from app.data.open_vocab import build_vocabulary
from app.schemas.request import ProcessRequest
from app.schemas.response import (
    DetectedObject,
    FrameDetections,
    ProcessResponse,
    Scene,
    TimelineEntry,
    Visualization,
)
from app.services import audio as audio_service
from app.services import description as desc_service
from app.services import vision_llm
from app.services.detector import build_response, detect, extract_objects
from app.services.fusion import filter_border_detections, mark_priority, merge_detections
from app.services.scene_cut import SceneCutDetector
from app.services.tracker import ObjectTracker
from app.utils.auth import verify_internal_key
from app.utils.image import decode_base64, resize_for_model, to_thumbnail_base64
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


def fill_track_gaps(frames: list[FrameDetections], max_gap: int) -> list[TimelineEntry]:
    """Construit la chronologie lissée à partir des détections par frame.

    La présence de chaque piste (label + trackId, ou label seul à défaut) est calculée par
    échantillon, puis les trous d'au plus `max_gap` échantillons entre deux détections d'une
    même piste sont comblés — supprime le scintillement des détections manquées.
    """
    presence: dict[tuple[str, int | None], set[int]] = {}
    for index, frame in enumerate(frames):
        for obj in frame.objects:
            presence.setdefault((obj.label, obj.trackId), set()).add(index)

    # Comblement : entre deux indices consécutifs d'une même piste, si l'écart laisse au plus
    # `max_gap` échantillons manquants, ils sont marqués présents.
    for indices in presence.values():
        ordered = sorted(indices)
        for current, following in zip(ordered, ordered[1:], strict=False):
            if 1 < following - current <= max_gap + 1:
                indices.update(range(current + 1, following))

    return [
        TimelineEntry(
            t=frame.t,
            labels=sorted(
                {label for (label, _track), indices in presence.items() if index in indices}
            ),
        )
        for index, frame in enumerate(frames)
    ]


def drop_brief_tracks(
    frames: list[FrameDetections],
    min_seconds: float,
    mirrors: list[list[DetectedObject]] | None = None,
) -> None:
    """Écarte les pistes dont la durée CUMULÉE de détection est inférieure à `min_seconds`.

    Présence CUMULÉE (et non continue) : on compte le nombre total de frames où la piste apparaît,
    sans exiger qu'elles soient consécutives. Les vrais objets du vocabulaire ouvert (mug, cup,
    glasses, suit…) sont détectés par INTERMITTENCE (le détecteur ouvert clignote) tout en étant bien
    présents ; un critère de continuité les éliminait à tort. Une hallucination ou un label parasite,
    lui, n'apparaît que sur une ou deux frames isolées : sa durée cumulée reste sous le seuil. Le
    seuil en frames est dérivé de la durée réelle d'échantillonnage (indépendant de la cadence). On
    retire ces pistes des boîtes par frame ET des listes miroir fournies (objets agrégés : mêmes
    instances mais conteneur de liste distinct). Une piste présente sur TOUTE la séquence analysée
    (clip très court) n'est jamais filtrée. Les objets non suivis (sans trackId) sont toujours
    conservés. `min_seconds <= 0` désactive le filtre. En place.
    """
    total = len(frames)
    if min_seconds <= 0 or total < 2:
        return
    # Intervalle d'échantillonnage réel (uniforme) → conversion durée → nombre de frames minimal.
    interval = (frames[-1].t - frames[0].t) / (total - 1)
    if interval <= 0:
        return
    min_frames = max(2, math.ceil(min_seconds / interval))

    counts: dict[int, int] = {}
    for frame in frames:
        for obj in frame.objects:
            if obj.trackId is not None:
                counts[obj.trackId] = counts.get(obj.trackId, 0) + 1
    # Fugace = vue sur trop peu de frames AU TOTAL ET absente d'au moins une : une piste présente sur
    # TOUTE la séquence analysée (cas d'un clip très court) n'est pas un artefact et reste conservée.
    transient = {
        track_id for track_id, count in counts.items() if count < min_frames and count < total
    }
    if not transient:
        return
    for frame in frames:
        frame.objects[:] = [obj for obj in frame.objects if obj.trackId not in transient]
    for objects in mirrors or []:
        objects[:] = [obj for obj in objects if obj.trackId not in transient]


def stabilize_track_labels(frames: list[FrameDetections]) -> None:
    """Assigne à chaque piste son label le plus probable et réécrit toutes ses détections.

    Une même piste peut être étiquetée différemment selon la frame (« car », puis « truck », puis
    « car ») alors qu'il s'agit du même objet : on retient le label dominant — vote au NOMBRE de
    frames, la confiance ne servant qu'à départager les ex æquo. Compter les frames (et non la somme
    des confiances) empêche un label parasite bref mais très confiant de détourner l'identité d'une
    piste : un chat flou sur un canapé net détecté « couch » sur quelques frames reste « cat » s'il
    l'a été sur davantage de frames. Supprime le scintillement et fiabilise le comblement des trous
    (clé de piste cohérente). Modification en place (objets partagés avec les réponses par frame).
    """
    votes: dict[int, dict[str, float]] = {}
    for frame in frames:
        for obj in frame.objects:
            if obj.trackId is None:
                continue
            label_votes = votes.setdefault(obj.trackId, {})
            # Chaque frame compte 1 ; la confiance (≤ 1) n'ajoute qu'un epsilon de départage.
            label_votes[obj.label] = label_votes.get(obj.label, 0.0) + 1.0 + obj.confidence * 0.001

    best_label = {
        track_id: max(label_votes.items(), key=lambda kv: kv[1])[0]
        for track_id, label_votes in votes.items()
    }
    for frame in frames:
        for obj in frame.objects:
            if obj.trackId is not None:
                obj.label = best_label[obj.trackId]


# Nombre maximal de pistes décrites dans le résumé de détection (les plus longues d'abord).
_DETECTION_SUMMARY_MAX = 12


def _position_zone(cx: float, lang: str) -> str:
    """Côté de l'image (gauche / centre / droite) d'un centre normalisé, localisé selon la langue."""
    if lang == "en":
        return "left" if cx < 0.4 else "right" if cx > 0.6 else "center"
    return "à gauche" if cx < 0.4 else "à droite" if cx > 0.6 else "au centre"


def _presence_phrase(span: float, duration: float, lang: str) -> str:
    """Présence qualitative d'une piste selon la part de la vidéo couverte (jamais en secondes)."""
    coverage = duration / span if span > 0 else 1.0
    if coverage >= 0.6:
        return "throughout" if lang == "en" else "tout du long"
    if coverage <= 0.25:
        return "briefly" if lang == "en" else "bref passage"
    return "on and off" if lang == "en" else "par intermittence"


def build_detection_summary(
    frames: list[FrameDetections],
    source_width: int | None,
    source_height: int | None,
    lang: str,
) -> str | None:
    """Résume les objets suivis (label, côté, présence) en INDICE INTERNE pour la synthèse.

    Regroupe les détections par piste (trackId) : label stabilisé, côté moyen dans l'image et
    présence qualitative — jamais d'horodatage ni de coordonnée d'écran (la synthèse n'en cite
    aucune). Pistes les plus longues d'abord, plafonnées. None si rien n'est suivi ou dimensions
    inconnues.
    """
    if not source_width or not source_height:
        return None

    label_by_track: dict[int, str] = {}
    t_min: dict[int, float] = {}
    t_max: dict[int, float] = {}
    cx_sum: dict[int, float] = {}
    samples: dict[int, int] = {}
    for frame in frames:
        for obj in frame.objects:
            if obj.trackId is None or obj.boundingBox is None or not obj.priority:
                continue
            tid = obj.trackId
            box = obj.boundingBox
            label_by_track[tid] = obj.label
            t_min[tid] = min(t_min.get(tid, frame.t), frame.t)
            t_max[tid] = max(t_max.get(tid, frame.t), frame.t)
            cx_sum[tid] = cx_sum.get(tid, 0.0) + (box.x + box.w / 2) / source_width
            samples[tid] = samples.get(tid, 0) + 1

    if not label_by_track:
        return None

    span = frames[-1].t - frames[0].t
    ordered = sorted(label_by_track, key=lambda tid: t_max[tid] - t_min[tid], reverse=True)
    parts = [
        f"{label_by_track[tid]} "
        f"({_position_zone(cx_sum[tid] / samples[tid], lang)}, "
        f"{_presence_phrase(span, t_max[tid] - t_min[tid], lang)})"
        for tid in ordered[:_DETECTION_SUMMARY_MAX]
    ]
    return " ; ".join(parts)


def _apply_vision(result: ProcessResponse, vision: vision_llm.VisionAnalysis | None) -> None:
    """Applique l'analyse vision au résultat : compte rendu et scène (si disponibles)."""
    if vision is None:
        return
    result.description = vision.description
    if vision.scene_label:
        # La scène vue par le modèle vision remplace l'heuristique COCO (plus précise).
        result.visualization.scene = Scene(
            label=vision.scene_label, confidence=0.9, indoor=vision.indoor
        )


async def _load_image_from_url(url: str) -> Image.Image:
    """Télécharge une image depuis une URL publique (http/https uniquement) et la retourne en RGB."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=422, detail="URL d'image invalide (schéma http/https requis)."
        )

    try:
        async with httpx.AsyncClient(timeout=settings.IMAGE_FETCH_TIMEOUT) as client:
            response = await client.get(url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=422, detail="Impossible de récupérer l'image depuis l'URL."
        ) from exc

    try:
        return Image.open(BytesIO(response.content)).convert("RGB")
    except Exception as exc:  # noqa: BLE001 — toute erreur de décodage devient un 422 client.
        raise HTTPException(
            status_code=422, detail="Le contenu de l'URL n'est pas une image valide."
        ) from exc


def _aggregate_video_responses(
    responses: list[ProcessResponse],
    lang: str,
    timeline: list[TimelineEntry] | None = None,
) -> ProcessResponse:
    """Agrège les réponses de plusieurs frames vidéo en une seule.

    Fusionne les objets uniques (meilleure confiance), choisit la scène la plus fréquente,
    agrège les tags, et régénère le compte rendu dans la langue demandée (chronologie incluse).
    """
    if not responses:
        raise ValueError("Aucune réponse à agréger.")

    best_conf: dict[str, float] = {}
    best_obj: dict[str, DetectedObject] = {}
    for resp in responses:
        for obj in resp.visualization.objects:
            if obj.label not in best_conf or obj.confidence > best_conf[obj.label]:
                best_conf[obj.label] = obj.confidence
                best_obj[obj.label] = obj
    merged_objects = list(best_obj.values())

    scene_labels = [resp.visualization.scene.label for resp in responses]
    most_common_label = Counter(scene_labels).most_common(1)[0][0]
    best_scene = next(
        resp.visualization.scene
        for resp in responses
        if resp.visualization.scene.label == most_common_label
    )

    colors = responses[0].visualization.colors
    all_tags = sorted({tag for resp in responses for tag in resp.visualization.tags})
    description_text = desc_service.generate(
        merged_objects, best_scene, None, lang, colors=colors, timeline=timeline
    )

    visualization = Visualization(
        objects=merged_objects,
        scene=best_scene,
        colors=colors,
        text=[],
        tags=all_tags,
    )

    return ProcessResponse(
        requestId=responses[-1].requestId,
        description=description_text,
        visualization=visualization,
        model=responses[-1].model,
        processingTimeMs=sum(resp.processingTimeMs for resp in responses),
    )


@router.post("/process", response_model=ProcessResponse)
async def process(
    body: ProcessRequest,
    request: Request,
    _: None = Depends(verify_internal_key),
) -> ProcessResponse:
    """Traite une requête multimodale (image, vidéo ou prompt) et retourne une analyse structurée."""
    runner = request.app.state.runner
    start = time.time()

    try:
        if body.type == "image":
            if body.imageBase64:
                try:
                    image = decode_base64(body.imageBase64)
                except ValueError as exc:
                    raise HTTPException(status_code=422, detail=str(exc)) from exc
            elif body.imageUrl:
                image = await _load_image_from_url(body.imageUrl)
            else:
                raise HTTPException(
                    status_code=422, detail="Le champ imageBase64 ou imageUrl est requis."
                )

            image = resize_for_model(image, settings.IMAGE_MAX_DIM)

            # Couverture maximale : COCO (précis sur ses 80 classes) ET le détecteur à
            # vocabulaire ouvert (concepts arbitraires) sont exécutés, puis leurs boîtes sont
            # fusionnées (une seule par objet, COCO prioritaire). La vision « décrit puis ancre » :
            # ses éléments forment le vocabulaire ouvert, élargi à la base LVIS si
            # IMAGE_OPEN_VOCAB_INCLUDE_BASE (couverture maximale en image).
            world = getattr(request.app.state, "world", None)
            vision = await vision_llm.describe_and_extract([image], body.lang, body.prompt)

            coco_objects = extract_objects(
                runner.predict(image, conf_threshold=settings.DISPLAY_MIN_CONFIDENCE)
            )
            world_ready = world is not None and world.is_ready()
            vocabulary = (
                build_vocabulary(
                    list(vision.elements) if vision else [],
                    include_base=settings.IMAGE_OPEN_VOCAB_INCLUDE_BASE,
                )
                if world_ready
                else []
            )
            # World n'est fusionné que s'il a un vocabulaire à chercher : sans base LVIS, un
            # vocabulaire vide (aucun élément vision) revient à COCO seul.
            if world_ready and world is not None and vocabulary:
                world_objects = extract_objects(world.detect_classes(image, vocabulary))
                objects = merge_detections(
                    coco_objects, world_objects, settings.MERGE_IOU_THRESHOLD
                )
                model_label = f"{runner.model_name} + {world.model_name}"
            else:
                objects = coco_objects
                model_label = runner.model_name

            # Les détections sous le seuil (vocabulaire ouvert) sont conservées mais marquées
            # non prioritaires : l'affichage les présente décochées par défaut, et le compte
            # rendu / la scène ne reposent que sur les détections prioritaires.
            objects = mark_priority(objects, settings.DISPLAY_MIN_CONFIDENCE)

            result = build_response(
                objects, image, body.prompt, body.lang, body.requestId, model_label
            )

            # Miniature + dimensions du référentiel des boîtes (image effectivement analysée).
            result.thumbnailBase64 = to_thumbnail_base64(image)
            result.sourceWidth, result.sourceHeight = image.size
            _apply_vision(result, vision)

        elif body.type == "video":
            if not body.videoBase64 and not body.videoUrl:
                raise HTTPException(
                    status_code=422,
                    detail="Le champ videoBase64 ou videoUrl est requis pour le type video.",
                )

            # Import différé : n'importe OpenCV que lorsqu'une vidéo est réellement traitée.
            from app.services import video as video_service

            # Le fichier temporaire est partagé entre l'extraction des frames et celle de l'audio.
            if body.videoUrl:
                # Vidéo de plateforme (YouTube / Twitch) : téléchargement contrôlé par yt-dlp.
                from app.services import video_download

                try:
                    tmp_path = await video_download.download_video_from_url(body.videoUrl)
                except video_download.VideoUrlError as exc:
                    raise HTTPException(status_code=422, detail=str(exc)) from exc
            else:
                try:
                    tmp_path = video_service.write_video_tempfile(body.videoBase64 or "")
                except ValueError as exc:
                    raise HTTPException(status_code=422, detail=str(exc)) from exc

            try:
                try:
                    frames = video_service.extract_frames_from_path(tmp_path)
                except video_service.VideoTooLongError as exc:
                    raise HTTPException(status_code=422, detail=str(exc)) from exc

                if not frames:
                    raise HTTPException(
                        status_code=422, detail="Impossible d'extraire des frames de la vidéo."
                    )

                # Indices des images clés envoyées au modèle vision (réparties sur la durée).
                n_keyframes = min(settings.VISION_MAX_FRAMES, len(frames))
                keyframe_indices = {
                    round(i * (len(frames) - 1) / max(1, n_keyframes - 1))
                    for i in range(n_keyframes)
                }

                # Analyse de la piste audio : transcription horodatée + bande-son (multi-titres).
                t_audio = time.time()
                transcript, transcript_segments, musics = await audio_service.analyze_audio(
                    tmp_path
                )
                logger.info(f"[{body.requestId}] audio : {time.time() - t_audio:.1f}s")
                music_summary = (
                    " ; ".join(f"{m.artist} — {m.title}" for m in musics) if musics else None
                )

                # Pipeline « décrire puis ancrer » : compte rendu visuel global sur les images clés
                # (transcription audio et bande-son fournies en contexte).
                vision_frames = [
                    resize_for_model(frames[i][0], settings.IMAGE_MAX_DIM)
                    for i in sorted(keyframe_indices)
                ]
                world = getattr(request.app.state, "world", None)
                t_vision = time.time()
                vision = await vision_llm.describe_and_extract(
                    vision_frames,
                    body.lang,
                    body.prompt,
                    transcript=transcript,
                    music_summary=music_summary,
                    is_video=True,
                )
                logger.info(
                    f"[{body.requestId}] vision (compte rendu global) : {time.time() - t_vision:.1f}s"
                )

                # Vocabulaire ouvert = éléments listés par la vision globale (et, en option, la base
                # LVIS — cf. OPEN_VOCAB_INCLUDE_BASE), dédupliqué : un vocabulaire unique pour toute
                # la vidéo (encodage CLIP mis en cache, détection cohérente).
                vision_elements: list[str] = list(vision.elements) if vision else []
                vision_elements = vision_elements[: settings.VIDEO_VOCAB_MAX]
                world_ready = world is not None and world.is_ready()
                vocabulary = (
                    build_vocabulary(vision_elements, include_base=settings.OPEN_VOCAB_INCLUDE_BASE)
                    if world_ready
                    else []
                )
                # World n'est utilisé que s'il a un vocabulaire à chercher : sans base LVIS, un
                # vocabulaire vide (aucun élément vision) revient à COCO seul.
                use_world = world_ready and bool(vocabulary)
                model_label = (
                    f"{runner.model_name} + {world.model_name}"
                    if use_world and world
                    else runner.model_name
                )

                # Tracker unifié (COCO + vocabulaire ouvert) propre à cette vidéo : il assigne des
                # identités stables aux détections fusionnées via un coût explicite (mouvement +
                # position + label + apparence). Cf. app/services/tracker.py.
                tracker = ObjectTracker()
                cut_detector = SceneCutDetector(settings.SCENE_CUT_THRESHOLD)
                frame_responses: list[ProcessResponse] = []
                frame_detections: list[FrameDetections] = []
                first_resized: Image.Image | None = None
                t_loop = time.time()
                for frame_index, (frame, timestamp) in enumerate(frames):
                    # Annulation côté client (bouton Stop) : on interrompt la boucle si la passerelle
                    # a fermé la connexion. Vérifié toutes les 10 frames seulement — l'appel
                    # `is_disconnected()` n'est pas gratuit et ne doit pas peser sur le débit
                    # d'inférence (la réactivité de /health est, elle, couverte par un timeout large
                    # côté passerelle).
                    if frame_index % 10 == 0 and await request.is_disconnected():
                        raise HTTPException(
                            status_code=499, detail="Analyse annulée (client déconnecté)."
                        )
                    resized = resize_for_model(frame, settings.IMAGE_MAX_DIM)
                    if first_resized is None:
                        first_resized = resized
                    # Coupure de plan (cut) : on réinitialise le suivi pour ne pas relier des objets
                    # de clips différents (compilations, montages) — réglable via SCENE_CUT_THRESHOLD.
                    if cut_detector.is_cut(resized):
                        tracker.reset()
                    # Détection seule (COCO + vocabulaire ouvert) puis fusion spatiale (une boîte
                    # par objet, COCO prioritaire) ; l'identité est attribuée juste après.
                    coco_objects = extract_objects(
                        runner.predict(resized, conf_threshold=settings.DISPLAY_MIN_CONFIDENCE)
                    )
                    if use_world and world:
                        world_objects = extract_objects(world.detect_classes(resized, vocabulary))
                        fused = merge_detections(
                            coco_objects, world_objects, settings.MERGE_IOU_THRESHOLD
                        )
                    else:
                        fused = coco_objects
                    # Écarte les détections tronquées par le bord (objet à moitié hors champ →
                    # label ambigu) avant le suivi — réglable via DETECTION_BORDER_MARGIN (0 = off).
                    fused = filter_border_detections(
                        fused, resized.width, resized.height, settings.DETECTION_BORDER_MARGIN
                    )
                    # Association inter-frames : identités stables dans un espace unique COCO+World.
                    objects = tracker.update(fused, resized)
                    # Détections sous le seuil conservées mais marquées non prioritaires (décochées
                    # par défaut à l'affichage ; exclues du compte rendu, de la scène et des tags).
                    objects = mark_priority(objects, settings.DISPLAY_MIN_CONFIDENCE)

                    frame_result = build_response(
                        objects, resized, body.prompt, body.lang, body.requestId, model_label
                    )
                    frame_responses.append(frame_result)
                    # Détections complètes de la frame (lecteur annoté côté frontend).
                    frame_detections.append(
                        FrameDetections(t=timestamp, objects=frame_result.visualization.objects)
                    )
                logger.info(
                    f"[{body.requestId}] détection par frame : {len(frame_responses)} frames "
                    f"en {time.time() - t_loop:.1f}s"
                )

                # Vidéo téléchargée depuis une URL : renvoyée à la passerelle pour stockage
                # (parité totale avec un upload — lecteur annoté, streaming, purge).
                downloaded_b64: str | None = None
                if body.videoUrl:
                    with open(tmp_path, "rb") as video_file:
                        downloaded_b64 = base64.b64encode(video_file.read()).decode()
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

            # Écarte d'abord les pistes trop fugaces (hallucinations du vocabulaire ouvert, labels
            # parasites de quelques frames) : un objet réel cumule plus d'une demi-seconde de présence.
            # Filtre les boîtes par frame ET l'agrégat (réponses par frame, qui partagent les objets).
            drop_brief_tracks(
                frame_detections,
                settings.VIDEO_MIN_TRACK_SECONDS,
                mirrors=[resp.visualization.objects for resp in frame_responses],
            )

            # Stabilise le label de chaque piste (label le plus probable sur sa durée de vie) :
            # supprime le scintillement « car/truck/car » sur un même objet suivi, et fiabilise
            # la chronologie (clé de piste cohérente). Doit précéder fill_track_gaps et l'agrégat.
            stabilize_track_labels(frame_detections)

            # Chronologie lissée : trous des pistes comblés (anti-scintillement).
            timeline = fill_track_gaps(frame_detections, settings.TIMELINE_GAP_FILL)

            result = _aggregate_video_responses(frame_responses, body.lang, timeline)
            result.timeline = timeline
            result.frames = frame_detections
            result.audioTranscript = transcript
            result.transcriptSegments = transcript_segments
            result.music = musics
            result.videoBase64 = downloaded_b64
            # Miniature et référentiel des boîtes : première frame analysée.
            if first_resized is not None:
                result.thumbnailBase64 = to_thumbnail_base64(first_resized)
                result.sourceWidth, result.sourceHeight = first_resized.size
            _apply_vision(result, vision)

            # Description finale cohérente : synthèse Groq de toutes les sources, par priorité
            # (le compte rendu visuel global fait foi ; détection + audio + musique le complètent).
            if vision and vision.description:
                detections_summary = build_detection_summary(
                    frame_detections, result.sourceWidth, result.sourceHeight, body.lang
                )
                t_synth = time.time()
                synthesized = await vision_llm.synthesize_description(
                    vision.description, detections_summary, transcript, music_summary, body.lang
                )
                logger.info(
                    f"[{body.requestId}] synthèse de description : {time.time() - t_synth:.1f}s"
                )
                if synthesized:
                    result.description = synthesized

        else:  # type == "prompt"
            blank_image = Image.new("RGB", (100, 100), "white")
            result = detect(blank_image, runner, body.prompt, body.lang, body.requestId)

        result.processingTimeMs = int((time.time() - start) * 1000)
        return result

    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — filet de sécurité : toute autre erreur → 500 générique.
        logger.error(f"Erreur lors du traitement de la requête {body.requestId} : {exc}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur.") from exc
