// Contrôleur de chat LLM — répond à une question de suivi sur un résultat d'analyse via Groq.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ChatExchange } from '../../models';
import groqService from '../../services/chat/groq.service';
import logger from '../../services/logger.service';
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
  const { question, context, lang } = request.body;
  const resolvedLang = lang ?? context.lang ?? 'fr';

  // Les erreurs (chat non configuré, échec Groq) remontent au gestionnaire d'erreurs global.
  const { answer, model } = await groqService.chatWithResult({
    question,
    context,
    lang: resolvedLang,
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
