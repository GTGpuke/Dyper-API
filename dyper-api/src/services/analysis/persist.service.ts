// Service de persistance des analyses : une ligne en base + médias sur disque.
// Partagé entre les routes legacy (/api/analyze*) et les conversations.
import { Analysis } from '../../models';
import type { AnalyzeType, ProcessAiResponse } from '../../types';
import logger from '../logger.service';
import { saveThumbnail, saveVideo } from '../media/media.service';

/**
 * Enregistre l'analyse en base sans bloquer la réponse (une erreur est journalisée, pas propagée).
 * Écrit la miniature renvoyée par dyper-ai sur disque — et la vidéo originale si fournie
 * (relecture annotée) — puis stocke leurs chemins relatifs.
 * Retourne la ligne créée, ou null en cas d'échec.
 */
export async function persistAnalysis(
  result: ProcessAiResponse,
  type: AnalyzeType,
  lang: string,
  userId: string | null,
  videoBuffer?: Buffer | null
): Promise<Analysis | null> {
  try {
    const thumbnailPath = result.thumbnailBase64
      ? await saveThumbnail(result.requestId, result.thumbnailBase64)
      : null;
    const videoPath = videoBuffer ? await saveVideo(result.requestId, videoBuffer) : null;

    return await Analysis.create({
      request_id: result.requestId,
      user_id: userId,
      type,
      lang,
      model: result.model,
      processing_time_ms: result.processingTimeMs,
      description: result.description,
      scene_label: result.visualization.scene.label,
      scene_confidence: result.visualization.scene.confidence,
      indoor: result.visualization.scene.indoor ?? null,
      objects_count: result.visualization.objects.length,
      tags: result.visualization.tags,
      colors: result.visualization.colors,
      thumbnail_path: thumbnailPath,
      timeline: result.timeline ?? null,
      objects: result.visualization.objects,
      source_width: result.sourceWidth ?? null,
      source_height: result.sourceHeight ?? null,
      audio_transcript: result.audioTranscript ?? null,
      video_path: videoPath,
      frame_detections: result.frames ?? null,
      music: result.music ?? null,
      transcript_segments: result.transcriptSegments ?? null,
      chapters: result.chapters ?? null,
    });
  } catch (e) {
    logger.error("Échec de la persistance de l'analyse.", {
      error: e,
      requestId: result.requestId,
    });
    return null;
  }
}
