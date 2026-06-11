"""Route principale POST /process du service dyper-ai."""

import base64
import os
import time
from collections import Counter
from io import BytesIO
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from PIL import Image

from app.config import settings
from app.schemas.request import ProcessRequest
from app.schemas.response import (
    FrameDetections,
    ProcessResponse,
    Scene,
    TimelineEntry,
    Visualization,
)
from app.services import audio as audio_service
from app.services import description as desc_service
from app.services import vision_llm
from app.services.detector import detect
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
    best_obj: dict = {}
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
                raise HTTPException(status_code=422, detail="imageBase64 ou imageUrl requis.")

            image = resize_for_model(image, settings.IMAGE_MAX_DIM)

            # Pipeline « décrire puis ancrer » : la vision liste les éléments réellement
            # visibles, puis le détecteur à vocabulaire ouvert les localise — les cadres
            # correspondent à la description. Repli COCO intégral sinon (pas de clé, échec).
            world = getattr(request.app.state, "world", None)
            vision = await vision_llm.describe_and_extract([image], body.lang, body.prompt)
            if vision and vision.elements and world is not None and world.is_ready():
                grounded = world.detect_classes(image, vision.elements)
                result = detect(
                    image, runner, body.prompt, body.lang, body.requestId, precomputed=grounded
                )
            else:
                result = detect(image, runner, body.prompt, body.lang, body.requestId)

            # Miniature + dimensions du référentiel des boîtes (image effectivement analysée).
            result.thumbnailBase64 = to_thumbnail_base64(image)
            result.sourceWidth, result.sourceHeight = image.size
            _apply_vision(result, vision)

        elif body.type == "video":
            if not body.videoBase64 and not body.videoUrl:
                raise HTTPException(
                    status_code=422, detail="videoBase64 ou videoUrl requis pour le type video."
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

                # Analyse de la piste audio d'abord : transcription + musique (parallèles),
                # transmises au modèle vision pour un compte rendu complet.
                transcript, music = await audio_service.analyze_audio(tmp_path)

                # Pipeline « décrire puis ancrer » : la vision analyse les images clés et
                # fournit le vocabulaire du détecteur. Repli COCO intégral sinon.
                vision_frames = [
                    resize_for_model(frames[i][0], settings.IMAGE_MAX_DIM)
                    for i in sorted(keyframe_indices)
                ]
                world = getattr(request.app.state, "world", None)
                vision = await vision_llm.describe_and_extract(
                    vision_frames,
                    body.lang,
                    body.prompt,
                    transcript=transcript,
                    music_summary=f"{music.artist} — {music.title}" if music else None,
                    is_video=True,
                )
                use_world = bool(
                    vision and vision.elements and world is not None and world.is_ready()
                )

                frame_responses: list[ProcessResponse] = []
                frame_detections: list[FrameDetections] = []
                first_resized: Image.Image | None = None
                for index, (frame, timestamp) in enumerate(frames):
                    resized = resize_for_model(frame, settings.IMAGE_MAX_DIM)
                    if first_resized is None:
                        first_resized = resized
                    # Tracking : IDs de piste stables entre frames (persist=False réinitialise
                    # le tracker au début de chaque nouvelle vidéo) — vocabulaire ouvert si la
                    # vision a fourni les éléments, classes COCO sinon.
                    if use_world and vision and world:
                        tracked = world.detect_classes(resized, vision.elements, persist=index > 0)
                    else:
                        tracked = runner.track(resized, persist=index > 0)
                    frame_result = detect(
                        resized,
                        runner,
                        body.prompt,
                        body.lang,
                        body.requestId,
                        precomputed=tracked,
                    )
                    frame_responses.append(frame_result)
                    # Détections complètes de la frame (lecteur annoté côté frontend).
                    frame_detections.append(
                        FrameDetections(t=timestamp, objects=frame_result.visualization.objects)
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

            # Chronologie lissée : trous des pistes comblés (anti-scintillement).
            timeline = fill_track_gaps(frame_detections, settings.TIMELINE_GAP_FILL)

            result = _aggregate_video_responses(frame_responses, body.lang, timeline)
            result.timeline = timeline
            result.frames = frame_detections
            result.audioTranscript = transcript
            result.music = music
            result.videoBase64 = downloaded_b64
            # Miniature et référentiel des boîtes : première frame analysée.
            if first_resized is not None:
                result.thumbnailBase64 = to_thumbnail_base64(first_resized)
                result.sourceWidth, result.sourceHeight = first_resized.size
            _apply_vision(result, vision)

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
