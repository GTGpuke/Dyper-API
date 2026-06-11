// Contrôleurs des messages de conversation : envoi (analyse ou chat) et streaming SSE.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { ChatExchange, Message } from '../../models';
import type Conversation from '../../models/Conversation';
import { DEFAULT_CONVERSATION_TITLE } from '../../models/Conversation';
import aiService from '../../services/ai/ai.service';
import { persistAnalysis } from '../../services/analysis/persist.service';
import groqService from '../../services/chat/groq.service';
import {
  buildChatContext,
  buildMessageViews,
  findOwnedConversation,
  latestAnalysis,
  nextSeq,
  touchConversation,
} from '../../services/conversations/conversation.service';
import sequelize from '../../services/db/database.service';
import { env } from '../../services/env.service';
import logger from '../../services/logger.service';
import { readThumbnailBase64 } from '../../services/media/media.service';
import type { AnalyzeType } from '../../types';
import { FileTooLargeError, InvalidFileTypeError, ValidationError } from '../../utils/errors';
import { isVideoPlatformUrl } from '../../utils/videoUrl';

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

// Auto-titre au premier message : texte ou nom de fichier, tronqué à 60 caractères.
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
async function createMessagePair(
  conversation: Conversation,
  userId: string,
  input: MessageInput,
  assistant: { kind: 'text' | 'analysis'; content: string; analysisRequestId: string | null }
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

  let assistant: { kind: 'text' | 'analysis'; content: string; analysisRequestId: string | null };

  if (input.fileBuffer && input.mimetype) {
    // Branche 1 — fichier joint : analyse image/vidéo.
    const isVideo = input.mimetype.startsWith('video/');
    const maxMb = isVideo ? env.MAX_VIDEO_SIZE_MB : env.MAX_FILE_SIZE_MB;
    if (input.fileBuffer.length > maxMb * 1024 * 1024) {
      throw new FileTooLargeError({ maxMb });
    }
    const requestId = uuidv4();
    const aiResponse = await aiService.process({
      requestId,
      fileBuffer: input.fileBuffer,
      mimetype: input.mimetype,
      prompt: input.text,
      lang: input.lang,
    });
    const type: AnalyzeType = isVideo ? 'video' : 'image';
    // Les vidéos originales sont conservées sur disque pour la relecture annotée.
    await persistAnalysis(aiResponse, type, input.lang, userId, isVideo ? input.fileBuffer : null);
    assistant = { kind: 'analysis', content: '', analysisRequestId: requestId };
  } else if (input.url) {
    // Branche 1 bis — analyse par URL : vidéo de plateforme (YouTube / Twitch) ou image.
    const requestId = uuidv4();
    if (isVideoPlatformUrl(input.url)) {
      const aiResponse = await aiService.process({
        requestId,
        videoUrl: input.url,
        prompt: input.text,
        lang: input.lang,
      });
      // La vidéo téléchargée par dyper-ai est stockée pour la relecture annotée.
      const videoBuffer = aiResponse.videoBase64
        ? Buffer.from(aiResponse.videoBase64, 'base64')
        : null;
      await persistAnalysis(aiResponse, 'video', input.lang, userId, videoBuffer);
    } else {
      const aiResponse = await aiService.process({
        requestId,
        imageUrl: input.url,
        prompt: input.text,
        lang: input.lang,
      });
      await persistAnalysis(aiResponse, 'image', input.lang, userId);
    }
    assistant = { kind: 'analysis', content: '', analysisRequestId: requestId };
  } else {
    const context = await latestAnalysis(conversation.id, userId);
    if (context) {
      // Branche 3 — question de suivi (chat non-streamé) sur la dernière analyse.
      // La miniature est jointe (best-effort) : le modèle répond en voyant l'image.
      const { answer, model } = await groqService.chatWithResult({
        question: input.text as string,
        context: buildChatContext(context),
        lang: input.lang,
        imageBase64: await readThumbnailBase64(context.thumbnail_path),
      });
      try {
        await ChatExchange.create({
          analysis_request_id: context.request_id,
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
      // Branche 2 — texte seul sans analyse antérieure : analyse de prompt (comportement historique).
      const requestId = uuidv4();
      const aiResponse = await aiService.process({
        requestId,
        prompt: input.text,
        lang: input.lang,
      });
      await persistAnalysis(aiResponse, 'prompt', input.lang, userId);
      assistant = { kind: 'analysis', content: '', analysisRequestId: requestId };
    }
  }

  const pair = await createMessagePair(conversation, userId, input, assistant);
  const views = await buildMessageViews(pair, userId);

  reply.status(201).send({
    success: true,
    conversation: conversation.toPublic(),
    messages: views,
  });
}

// Détecte une interruption volontaire du flux (abandon client), à ne pas journaliser en erreur.
function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name.toLowerCase().includes('abort');
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
  const analysisRow = await latestAnalysis(conversation.id, userId);
  if (!analysisRow) {
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

  // La miniature est jointe (best-effort) : le modèle répond en voyant l'image.
  const { stream, model } = await groqService.streamChatWithResult({
    question: text,
    context: buildChatContext(analysisRow),
    lang,
    imageBase64: await readThumbnailBase64(analysisRow.thumbnail_path),
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
        analysis_request_id: analysisRow.request_id,
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
