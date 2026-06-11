// Contrôleur de chat LLM — répond à une question de suivi sur un résultat d'analyse via Groq.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Analysis, ChatExchange } from '../../models';
import groqService from '../../services/chat/groq.service';
import { buildChatContext } from '../../services/conversations/conversation.service';
import logger from '../../services/logger.service';
import { readThumbnailBase64 } from '../../services/media/media.service';
import type { ChatContext } from '../../types';

interface ChatBody {
  question: string;
  context: ChatContext;
  lang?: string;
}

// POST /api/chat — { question, context, lang? } → { success, answer }.
export async function chat(
  request: FastifyRequest<{ Body: ChatBody }>,
  reply: FastifyReply
): Promise<void> {
  const { question, context: clientContext, lang } = request.body;
  const resolvedLang = lang ?? clientContext.lang ?? 'fr';

  // Si l'analyse est connue en base (requestId, cloisonné par utilisateur), le contexte serveur
  // remplace celui du client (transcription incluse) et la miniature est jointe (chat vision).
  let context = clientContext;
  let imageBase64: string | null = null;
  if (clientContext.requestId) {
    const analysis = await Analysis.findOne({
      where: { request_id: clientContext.requestId, user_id: request.authUser?.id },
    });
    if (analysis) {
      context = buildChatContext(analysis);
      imageBase64 = await readThumbnailBase64(analysis.thumbnail_path);
    }
  }

  // Les erreurs (chat non configuré, échec Groq) remontent au gestionnaire d'erreurs global.
  const { answer, model } = await groqService.chatWithResult({
    question,
    context,
    lang: resolvedLang,
    imageBase64,
  });

  // Persistance non bloquante de l'échange.
  try {
    await ChatExchange.create({
      analysis_request_id: context.requestId ?? null,
      user_id: request.authUser?.id ?? null,
      question,
      answer,
      lang: resolvedLang,
      model,
    });
  } catch (e) {
    logger.error("Échec de la persistance de l'échange de chat.", { error: e });
  }

  reply.send({ success: true, answer });
}
