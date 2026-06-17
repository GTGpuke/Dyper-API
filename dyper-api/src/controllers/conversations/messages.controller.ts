// Contrôleurs des messages de conversation : envoi (analyse ou chat) et streaming SSE.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import type { Analysis } from '../../models';
import { ChatExchange, Message } from '../../models';
import type Conversation from '../../models/Conversation';
import { DEFAULT_CONVERSATION_TITLE } from '../../models/Conversation';
import groqService from '../../services/chat/groq.service';
import {
  type AnalysisJob,
  cancelConversationAnalysis,
  runAnalysisJob,
} from '../../services/conversations/analysis-job.service';
import {
  analysesInConversation,
  buildChatContext,
  buildMessageViews,
  findOwnedConversation,
  nextSeq,
  recentChatHistory,
  touchConversation,
} from '../../services/conversations/conversation.service';
import sequelize from '../../services/db/database.service';
import { env } from '../../services/env.service';
import logger from '../../services/logger.service';
import { readThumbnailBase64 } from '../../services/media/media.service';
import { assertWithinQuota, queuePriority } from '../../services/plan/plan.service';
import { InvalidFileTypeError, ValidationError } from '../../utils/errors';
import { isVideoPlatformUrl } from '../../utils/videoUrl';

// Construit les paramètres de contexte/images pour le chat Groq à partir des analyses du fil.
// Mono-analyse : conserve la forme historique (`context` + `imageBase64`). Multi-analyses (2+) :
// passe `contexts` + `images` pour un chat de COMPARAISON (le modèle voit tous les médias).
async function buildChatGroqParams(
  analyses: Analysis[]
): Promise<
  | { context: ReturnType<typeof buildChatContext>; imageBase64: string | null }
  | { contexts: ReturnType<typeof buildChatContext>[]; images: string[] }
> {
  if (analyses.length <= 1) {
    const a = analyses[0];
    return {
      context: buildChatContext(a),
      imageBase64: await readThumbnailBase64(a.thumbnail_path),
    };
  }
  const contexts = analyses.map((a) => buildChatContext(a));
  const images = (
    await Promise.all(analyses.map((a) => readThumbnailBase64(a.thumbnail_path)))
  ).filter((b): b is string => Boolean(b));
  return { contexts, images };
}

// Entrée normalisée d'un envoi de message (multipart ou JSON).
interface MessageInput {
  text: string | null;
  url: string | null;
  lang: string;
  fileBuffer: Buffer | null;
  mimetype: string | null;
  filename: string | null;
}

// Lit le corps multipart (fichier + champs) ou JSON et normalise l'entrée.
async function readMessageInput(request: FastifyRequest): Promise<MessageInput> {
  const input: MessageInput = {
    text: null,
    url: null,
    lang: 'fr',
    fileBuffer: null,
    mimetype: null,
    filename: null,
  };

  if (request.isMultipart()) {
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        input.mimetype = part.mimetype;
        if (!(env.ALLOWED_MIME_TYPES as readonly string[]).includes(part.mimetype)) {
          throw new InvalidFileTypeError({ received: part.mimetype });
        }
        input.fileBuffer = await part.toBuffer();
        input.filename = part.filename || 'fichier';
      } else if (part.fieldname === 'text') {
        input.text = String(part.value).trim() || null;
      } else if (part.fieldname === 'url') {
        input.url = String(part.value).trim() || null;
      } else if (part.fieldname === 'lang') {
        input.lang = String(part.value) || 'fr';
      }
    }
  } else {
    const body = (request.body ?? {}) as { text?: string; url?: string; lang?: string };
    input.text = body.text?.trim() || null;
    input.url = body.url?.trim() || null;
    input.lang = body.lang || 'fr';
  }

  if (!input.fileBuffer && !input.url && !input.text) {
    throw new ValidationError('Un message doit contenir un texte, un fichier ou une URL.');
  }
  if (input.url && !/^https?:\/\//i.test(input.url)) {
    throw new ValidationError("L'URL doit commencer par http:// ou https://.");
  }
  return input;
}

// Auto-titre au premier message : texte de l'utilisateur, sinon nom de fichier ou URL. Pour un
// média analysé sans texte, le titre est ensuite affiné avec la description (cf. analysis-job).
function autoTitle(input: MessageInput): string {
  const base =
    input.text?.replace(/\s+/g, ' ').trim() ||
    input.filename ||
    input.url ||
    DEFAULT_CONVERSATION_TITLE;
  const chars = Array.from(base);
  return chars.length > 60 ? `${chars.slice(0, 59).join('')}…` : base;
}

// Crée la paire de messages (user + assistant) en transaction, avec auto-titre et touch.
// `assistantStatus` vaut « queued » pour une carte d'analyse (file de capacité), « ready » sinon.
async function createMessagePair(
  conversation: Conversation,
  userId: string,
  input: MessageInput,
  assistant: { kind: 'text' | 'analysis'; content: string; analysisRequestId: string | null },
  assistantStatus: 'queued' | 'pending' | 'ready'
): Promise<Message[]> {
  return sequelize.transaction(async (tx) => {
    const seq = await nextSeq(conversation.id, tx);

    const userMessage = await Message.create(
      {
        conversation_id: conversation.id,
        user_id: userId,
        role: 'user',
        kind: 'text',
        content: input.text ?? '',
        attachment_name: input.filename ?? input.url,
        seq,
      },
      { transaction: tx }
    );

    const assistantMessage = await Message.create(
      {
        conversation_id: conversation.id,
        user_id: userId,
        role: 'assistant',
        kind: assistant.kind,
        content: assistant.content,
        analysis_request_id: assistant.analysisRequestId,
        status: assistantStatus,
        seq: seq + 1,
      },
      { transaction: tx }
    );

    // Auto-titre uniquement au tout premier échange, si le titre est encore celui par défaut.
    if (seq === 1 && conversation.title === DEFAULT_CONVERSATION_TITLE) {
      conversation.title = autoTitle(input);
    }
    await touchConversation(conversation, tx);

    return [userMessage, assistantMessage];
  });
}

// POST /api/conversations/:id/messages — envoi d'un message (analyse ou chat non-streamé).
export async function postMessage(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  const conversation = await findOwnedConversation(request.params.id, userId);
  const input = await readMessageInput(request);

  // Spécification d'une analyse à lancer en TÂCHE DE FOND (null pour une question de suivi/chat).
  let jobSpec: Omit<
    AnalysisJob,
    'conversationId' | 'userMessageId' | 'assistantMessageId' | 'titleFromDescription'
  > | null = null;
  let assistant: { kind: 'text' | 'analysis'; content: string; analysisRequestId: string | null };
  // Statut initial de la carte assistant : une analyse part « queued » (elle passera par la file de
  // capacité avant d'être traitée — cf. analysis-job) ; une réponse de chat est directement « ready ».
  let initialStatus: 'queued' | 'ready' = 'ready';

  if (input.fileBuffer && input.mimetype) {
    // Branche 1 — fichier joint : analyse image/vidéo (tâche de fond).
    const isVideo = input.mimetype.startsWith('video/');
    const plan = await assertWithinQuota(userId, { isVideo, fileBytes: input.fileBuffer.length });
    const requestId = uuidv4();
    jobSpec = {
      requestId,
      userId,
      priority: queuePriority(plan),
      type: isVideo ? 'video' : 'image',
      isVideo,
      fileBuffer: input.fileBuffer,
      mimetype: input.mimetype,
      prompt: input.text,
      lang: input.lang,
    };
    assistant = { kind: 'analysis', content: '', analysisRequestId: requestId };
    initialStatus = 'queued';
  } else if (input.url) {
    // Branche 1 bis — analyse par URL : vidéo de plateforme (YouTube / Twitch) ou image.
    const isVideo = isVideoPlatformUrl(input.url);
    const plan = await assertWithinQuota(userId, { isVideo });
    const requestId = uuidv4();
    jobSpec = {
      requestId,
      userId,
      priority: queuePriority(plan),
      type: isVideo ? 'video' : 'image',
      isVideo,
      imageUrl: isVideo ? undefined : input.url,
      videoUrl: isVideo ? input.url : undefined,
      prompt: input.text,
      lang: input.lang,
    };
    assistant = { kind: 'analysis', content: '', analysisRequestId: requestId };
    initialStatus = 'queued';
  } else {
    const analyses = await analysesInConversation(conversation.id, userId);
    if (analyses.length > 0) {
      // Branche 3 — question de suivi (chat non-streamé) : SYNCHRONE (réponse courte, non reprise).
      // Avec 2+ analyses dans le fil, le contexte couvre TOUS les médias (chat de comparaison).
      const { answer, model } = await groqService.chatWithResult({
        question: input.text as string,
        ...(await buildChatGroqParams(analyses)),
        lang: input.lang,
        history: await recentChatHistory(conversation.id),
      });
      try {
        await ChatExchange.create({
          // Échange rattaché à la dernière analyse du fil (ancrage de l'historique de suivi).
          analysis_request_id: analyses[analyses.length - 1].request_id,
          user_id: userId,
          question: input.text as string,
          answer,
          lang: input.lang,
          model,
        });
      } catch (e) {
        logger.error("Échec de la persistance de l'échange de chat.", { error: e });
      }
      assistant = { kind: 'text', content: answer, analysisRequestId: null };
    } else {
      // Branche 2 — texte seul sans analyse antérieure : analyse de prompt (tâche de fond).
      const plan = await assertWithinQuota(userId, { isVideo: false });
      const requestId = uuidv4();
      jobSpec = {
        requestId,
        userId,
        priority: queuePriority(plan),
        type: 'prompt',
        isVideo: false,
        prompt: input.text,
        lang: input.lang,
      };
      assistant = { kind: 'analysis', content: '', analysisRequestId: requestId };
      initialStatus = 'queued';
    }
  }

  // Auto-titre depuis la description : seulement pour un média sans texte, au premier échange.
  const titleFromDescription = !input.text && conversation.title === DEFAULT_CONVERSATION_TITLE;

  const pair = await createMessagePair(conversation, userId, input, assistant, initialStatus);

  // Analyse : lancée en tâche de fond (détachée de la requête) — elle survit au reload/à la fermeture.
  if (jobSpec) {
    void runAnalysisJob({
      ...jobSpec,
      conversationId: conversation.id,
      userMessageId: pair[0].id,
      assistantMessageId: pair[1].id,
      titleFromDescription,
    });
  }

  const views = await buildMessageViews(pair, userId);
  reply.status(201).send({
    success: true,
    conversation: conversation.toPublic(),
    messages: views,
  });
}

// POST /api/conversations/:id/cancel — annule l'analyse en cours (bouton Stop). Supprime l'échange.
export async function cancelMessage(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  await findOwnedConversation(request.params.id, userId);
  const cancelled = cancelConversationAnalysis(request.params.id);
  reply.send({ success: true, cancelled });
}

// Détecte une interruption volontaire (abandon client) : AbortError natif ou annulation Axios
// (CanceledError / code ERR_CANCELED), à ne jamais journaliser en erreur.
function isAbortError(e: unknown): boolean {
  if (e instanceof Error) {
    const name = e.name.toLowerCase();
    if (name.includes('abort') || name.includes('cancel')) return true;
  }
  return (e as { code?: string } | null)?.code === 'ERR_CANCELED';
}

// POST /api/conversations/:id/messages/stream — question de suivi streamée (SSE).
export async function streamMessage(
  request: FastifyRequest<{ Params: { id: string }; Body: { text: string; lang?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  const { text, lang = 'fr' } = request.body;

  // Phase 1 — toutes les erreurs métier AVANT le moindre octet (réponses JSON normales).
  const conversation = await findOwnedConversation(request.params.id, userId);
  groqService.assertConfigured();
  const analyses = await analysesInConversation(conversation.id, userId);
  if (analyses.length === 0) {
    throw new ValidationError(
      'Cette conversation ne contient aucune analyse : utilisez le endpoint non-streamé.'
    );
  }

  // Le message utilisateur est persisté immédiatement (conservé même si le flux échoue).
  const userSeq = await nextSeq(conversation.id);
  await Message.create({
    conversation_id: conversation.id,
    user_id: userId,
    role: 'user',
    kind: 'text',
    content: text,
    seq: userSeq,
  });
  await touchConversation(conversation);

  // La miniature est jointe (best-effort) : le modèle répond en voyant l'image. L'historique
  // (hors message courant, déjà persisté à userSeq) donne au modèle la mémoire du fil.
  const { stream, model } = await groqService.streamChatWithResult({
    question: text,
    ...(await buildChatGroqParams(analyses)),
    lang,
    history: await recentChatHistory(conversation.id, userSeq),
  });

  // Phase 2 — bascule en SSE : le cycle de vie Fastify (handler d'erreurs inclus) ne s'applique plus.
  // Les headers déjà bufferisés (CORS, rate-limit, helmet) sont préservés, valeurs vides exclues.
  reply.hijack();
  const headers: Record<string, string | number | string[]> = {};
  for (const [key, value] of Object.entries(reply.getHeaders())) {
    if (value !== undefined) headers[key] = value;
  }
  reply.raw.writeHead(200, {
    ...headers,
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });

  // Abandon côté client → interrompt le flux Groq.
  request.raw.on('close', () => {
    if (!reply.raw.writableEnded) stream.controller.abort();
  });

  let full = '';
  try {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (!delta) continue;
      full += delta;
      reply.raw.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }

    // Phase 3 — persistance de fin (réponse complète + échange legacy + activité).
    const assistantMessage = await Message.create({
      conversation_id: conversation.id,
      user_id: userId,
      role: 'assistant',
      kind: 'text',
      content: full,
      seq: userSeq + 1,
    });
    try {
      await ChatExchange.create({
        // Rattaché à la dernière analyse du fil (ancrage de l'historique de suivi).
        analysis_request_id: analyses[analyses.length - 1].request_id,
        user_id: userId,
        question: text,
        answer: full,
        lang,
        model,
      });
    } catch (e) {
      logger.error("Échec de la persistance de l'échange de chat.", { error: e });
    }
    await touchConversation(conversation);

    reply.raw.write(
      `event: done\ndata: ${JSON.stringify({
        messageId: assistantMessage.id,
        conversationId: conversation.id,
      })}\n\n`
    );
  } catch (e) {
    if (!isAbortError(e)) {
      logger.error('Erreur pendant le streaming du chat.', { error: e });
      if (!reply.raw.writableEnded) {
        reply.raw.write(
          `event: error\ndata: ${JSON.stringify({
            code: 'CHAT_PROCESSING_ERROR',
            message: 'Erreur lors de la génération de la réponse du chat.',
          })}\n\n`
        );
      }
    }
  } finally {
    if (!reply.raw.writableEnded) {
      reply.raw.end();
    }
  }
}
