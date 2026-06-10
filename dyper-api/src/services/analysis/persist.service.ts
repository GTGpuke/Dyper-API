// Service de persistance des analyses : une ligne en base + miniature sur disque.
// Partagé entre les routes legacy (/api/analyze*) et les conversations.
import { Analysis } from '../../models';
import type { AnalyzeType, ProcessAiResponse } from '../../types';
import logger from '../logger.service';
import { saveThumbnail } from '../media/media.service';

/**
 * Enregistre l'analyse en base sans bloquer la réponse (une erreur est journalisée, pas propagée).
 * Écrit la miniature renvoyée par dyper-ai sur disque et stocke son chemin relatif.
 * Retourne la ligne créée, ou null en cas d'échec.
 */
export async function persistAnalysis(
  result: ProcessAiResponse,
  type: AnalyzeType,
  lang: string,
  userId: string | null
): Promise<Analysis | null> {
  try {
    const thumbnailPath = result.thumbnailBase64
      ? await saveThumbnail(result.requestId, result.thumbnailBase64)
      : null;

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
    });
  } catch (e) {
    logger.error("Échec de la persistance de l'analyse.", {
      error: e,
      requestId: result.requestId,
    });
    return null;
  }
}
