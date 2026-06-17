// Helpers partagés des conversations : cloisonnement, ordre des messages, vues client.
import type { Transaction } from 'sequelize';
import { Op } from 'sequelize';
import { Analysis, Conversation, Message } from '../../models';
import type { ChatContext, InlineAnalysis, MessageView } from '../../types';
import { NotFoundError } from '../../utils/errors';

/** Récupère une conversation appartenant à l'utilisateur, sinon 404 (anti-IDOR). */
export async function findOwnedConversation(id: string, userId: string): Promise<Conversation> {
  const conversation = await Conversation.findOne({ where: { id, user_id: userId } });
  if (!conversation) throw new NotFoundError('Conversation introuvable.');
  return conversation;
}

/** Met à jour la date de dernière activité (updated_at est maintenu manuellement). */
export async function touchConversation(
  conversation: Conversation,
  transaction?: Transaction
): Promise<void> {
  conversation.updated_at = new Date();
  await conversation.save({ transaction });
}

/** Prochain numéro d'ordre dans la conversation (fiable même à la même milliseconde). */
export async function nextSeq(conversationId: string, transaction?: Transaction): Promise<number> {
  const max = (await Message.max('seq', {
    where: { conversation_id: conversationId },
    transaction,
  })) as number | null;
  return (max ?? 0) + 1;
}

/** Construit la vue inlinée d'une analyse pour une carte de message. */
export function toInlineAnalysis(analysis: Analysis): InlineAnalysis {
  return {
    id: analysis.id,
    requestId: analysis.request_id,
    type: analysis.type,
    description: analysis.description,
    model: analysis.model,
    lang: analysis.lang,
    sceneLabel: analysis.scene_label,
    sceneConfidence: analysis.scene_confidence,
    indoor: analysis.indoor,
    objects: analysis.objects ?? [],
    colors: analysis.colors,
    tags: analysis.tags,
    timeline: analysis.timeline,
    sourceWidth: analysis.source_width,
    sourceHeight: analysis.source_height,
    thumbnailUrl: analysis.thumbnail_path ? `/api/media/${analysis.request_id}` : null,
    audioTranscript: analysis.audio_transcript,
    videoUrl: analysis.video_path ? `/api/media/${analysis.request_id}/video` : null,
    frames: analysis.frame_detections,
    music: analysis.music,
    transcriptSegments: analysis.transcript_segments,
  };
}

/** Construit les vues client des messages, analyses inlinées en deux requêtes (pas de N+1). */
export async function buildMessageViews(
  messages: Message[],
  userId: string
): Promise<MessageView[]> {
  const requestIds = messages
    .map((m) => m.analysis_request_id)
    .filter((id): id is string => Boolean(id));

  const analyses =
    requestIds.length > 0
      ? await Analysis.findAll({
          where: { request_id: { [Op.in]: requestIds }, user_id: userId },
        })
      : [];
  const byRequestId = new Map(analyses.map((a) => [a.request_id, a]));

  return messages.map((m) => {
    const analysis = m.analysis_request_id ? byRequestId.get(m.analysis_request_id) : undefined;
    return {
      id: m.id,
      role: m.role,
      kind: m.kind,
      content: m.content,
      attachmentName: m.attachment_name,
      status: m.status ?? 'ready',
      seq: m.seq,
      createdAt: m.created_at,
      analysis: analysis ? toInlineAnalysis(analysis) : null,
    };
  });
}

/**
 * Derniers tours TEXTUELS de la conversation (questions de l'utilisateur + réponses de Dyper),
 * pour donner au chat la mémoire du fil. Les cartes d'analyse (contenu vide) sont ignorées.
 * `beforeSeq` exclut le message courant déjà persisté (cas du streaming).
 */
export async function recentChatHistory(
  conversationId: string,
  beforeSeq?: number,
  limit = 10
): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const where: Record<string, unknown> = {
    conversation_id: conversationId,
    kind: 'text',
    content: { [Op.ne]: '' },
  };
  if (beforeSeq !== undefined) where.seq = { [Op.lt]: beforeSeq };

  const rows = await Message.findAll({ where, order: [['seq', 'DESC']], limit });
  return rows.reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

/** Dernière analyse de la conversation (contexte du chat de suivi), ou null. */
export async function latestAnalysis(
  conversationId: string,
  userId: string
): Promise<Analysis | null> {
  const lastCard = await Message.findOne({
    where: { conversation_id: conversationId, kind: 'analysis' },
    order: [['seq', 'DESC']],
  });
  if (!lastCard?.analysis_request_id) return null;
  return Analysis.findOne({
    where: { request_id: lastCard.analysis_request_id, user_id: userId },
  });
}

/**
 * Toutes les analyses RÉUSSIES de la conversation, dans l'ordre du fil (la plus ancienne d'abord),
 * pour un chat de COMPARAISON multi-médias. Une carte d'analyse sans ligne persistée (échec) est
 * ignorée. Plafonné aux `limit` plus récentes afin de borner les tokens et les images envoyés au
 * modèle. Renvoie un tableau vide si la conversation ne contient aucune analyse exploitable.
 */
export async function analysesInConversation(
  conversationId: string,
  userId: string,
  limit = 4
): Promise<Analysis[]> {
  const cards = await Message.findAll({
    where: { conversation_id: conversationId, kind: 'analysis' },
    order: [['seq', 'ASC']],
  });
  const requestIds = cards
    .map((c) => c.analysis_request_id)
    .filter((id): id is string => Boolean(id));
  if (requestIds.length === 0) return [];

  const rows = await Analysis.findAll({
    where: { request_id: { [Op.in]: requestIds }, user_id: userId },
  });
  // `findAll` ne garantit pas l'ordre des request_id : on réordonne selon la séquence du fil, puis on
  // ne garde que les plus récentes (fin du tableau) si la conversation en compte beaucoup.
  const byRequestId = new Map(rows.map((r) => [r.request_id, r]));
  const ordered = requestIds
    .map((id) => byRequestId.get(id))
    .filter((a): a is Analysis => Boolean(a));
  return ordered.slice(-limit);
}

/** Reconstruit le contexte de chat à partir d'une ligne d'analyse persistée (source serveur). */
export function buildChatContext(analysis: Analysis): ChatContext {
  return {
    description: analysis.description,
    model: analysis.model,
    lang: analysis.lang,
    requestId: analysis.request_id,
    timeline: analysis.timeline,
    audioTranscript: analysis.audio_transcript,
    music: analysis.music,
    frameDetections: analysis.frame_detections,
    transcriptSegments: analysis.transcript_segments,
    sourceWidth: analysis.source_width,
    sourceHeight: analysis.source_height,
    visualization: {
      objects: analysis.objects ?? [],
      scene: {
        label: analysis.scene_label,
        confidence: analysis.scene_confidence,
        indoor: analysis.indoor,
      },
      colors: analysis.colors,
      tags: analysis.tags,
      text: [],
    },
  };
}
