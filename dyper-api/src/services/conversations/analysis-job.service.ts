// Analyse de conversation en TÂCHE DE FOND : lancée détachée de la requête HTTP, elle survit donc
// à un reload ou à la fermeture de l'onglet (contrairement aux endpoints /analyze synchrones).
// La carte d'analyse est persistée immédiatement en statut « pending », puis mise à jour à la fin
// (« ready » avec l'analyse liée, ou « error »). Une annulation EXPLICITE (bouton Stop → endpoint
// dédié) interrompt le traitement et supprime l'échange. Le client suit l'état par sondage.
import { Conversation, Message } from '../../models';
import type { AnalyzeType } from '../../types';
import aiService from '../ai/ai.service';
import { persistAnalysis } from '../analysis/persist.service';
import { acquireSlot, type ReleaseSlot } from '../capacity/capacity.service';
import logger from '../logger.service';
import { recordAnalysisUsage } from '../plan/plan.service';

// Une analyse en cours par conversation (le client empêche d'en lancer deux). Clé = conversationId.
const jobs = new Map<string, AbortController>();

export interface AnalysisJob {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  requestId: string;
  userId: string;
  /** Priorité de file d'attente (issue du forfait). */
  priority: number;
  /** Type d'analyse pour la persistance. */
  type: AnalyzeType;
  isVideo: boolean;
  fileBuffer?: Buffer;
  mimetype?: string;
  imageUrl?: string;
  videoUrl?: string;
  prompt: string | null;
  lang: string;
  /** Renommer la conversation avec la description produite (média sans texte, premier échange). */
  titleFromDescription: boolean;
}

/** Annule l'analyse en cours d'une conversation (bouton Stop). Retourne false si aucune. */
export function cancelConversationAnalysis(conversationId: string): boolean {
  const ac = jobs.get(conversationId);
  if (!ac) return false;
  ac.abort();
  return true;
}

// Tronque une description en titre de conversation (≤ 60 caractères).
function descriptionTitle(description: string): string {
  const base = description.replace(/\s+/g, ' ').trim();
  const chars = Array.from(base);
  return chars.length > 60 ? `${chars.slice(0, 59).join('')}…` : base;
}

/**
 * Exécute l'analyse en tâche de fond et met à jour la carte persistée. Ne rejette jamais (toute
 * erreur est journalisée et reflétée dans le statut du message) afin d'éviter un rejet non géré.
 */
export async function runAnalysisJob(job: AnalysisJob): Promise<void> {
  const ac = new AbortController();
  jobs.set(job.conversationId, ac);
  let release: ReleaseSlot | undefined;

  try {
    release = await acquireSlot(job.priority, ac.signal);
    // Créneau de calcul obtenu : la carte passe de « en file » à « en traitement » (le client
    // affiche alors la progression réelle plutôt que l'attente).
    await Message.update({ status: 'pending' }, { where: { id: job.assistantMessageId } });
    const aiResponse = await aiService.process({
      requestId: job.requestId,
      fileBuffer: job.fileBuffer,
      mimetype: job.mimetype,
      imageUrl: job.imageUrl,
      videoUrl: job.videoUrl,
      prompt: job.prompt,
      lang: job.lang,
      signal: ac.signal,
    });

    // Vidéo conservée pour la relecture annotée (upload local ou téléchargée depuis une URL).
    const videoBuffer =
      job.type === 'video'
        ? (job.fileBuffer ??
          (aiResponse.videoBase64 ? Buffer.from(aiResponse.videoBase64, 'base64') : null))
        : null;

    await persistAnalysis(aiResponse, job.type, job.lang, job.userId, videoBuffer);
    await recordAnalysisUsage(job.userId, { isVideo: job.isVideo, aiResponse });
    await Message.update({ status: 'ready' }, { where: { id: job.assistantMessageId } });

    if (job.titleFromDescription && aiResponse.description) {
      const conv = await Conversation.findByPk(job.conversationId);
      // Sécurité : ne renomme que si le titre est encore celui par défaut ou un nom de fichier brut.
      if (conv && conv.title !== descriptionTitle(aiResponse.description)) {
        conv.title = descriptionTitle(aiResponse.description);
        await conv.save();
      }
    }

    logger.info('Analyse terminée (tâche de fond).', {
      requestId: job.requestId,
      conversationId: job.conversationId,
    });
  } catch (e) {
    if (ac.signal.aborted) {
      // Annulation volontaire : on retire l'échange (question + carte), comme s'il n'avait pas eu lieu.
      await Message.destroy({
        where: { id: [job.userMessageId, job.assistantMessageId] },
      }).catch(() => undefined);
      logger.info('Analyse annulée (tâche de fond).', { conversationId: job.conversationId });
    } else {
      await Message.update({ status: 'error' }, { where: { id: job.assistantMessageId } }).catch(
        () => undefined
      );
      logger.error('Échec de l’analyse (tâche de fond).', {
        requestId: job.requestId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  } finally {
    release?.();
    jobs.delete(job.conversationId);
  }
}
