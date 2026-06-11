// Contrôleurs d'analyse — exposent les trois modes : fichier uploadé, URL et prompt textuel.
// Préserve le contrat de réponse Dyper : { success, requestId, processingTime, result }.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import aiService from '../../services/ai/ai.service';
import { persistAnalysis } from '../../services/analysis/persist.service';
import { env } from '../../services/env.service';
import logger from '../../services/logger.service';
import type { AnalysisResult, ProcessAiResponse } from '../../types';
import { FileTooLargeError, InvalidFileTypeError, ValidationError } from '../../utils/errors';
import { isVideoPlatformUrl } from '../../utils/videoUrl';

interface AnalyzeBody {
  prompt?: string;
  lang?: string;
}

interface AnalyzeUrlBody extends AnalyzeBody {
  url: string;
}

// Construit l'enveloppe de réponse standard Dyper.
// La miniature et la vidéo base64 sont volontairement exclues (servies par /api/media).
function sendResult(
  reply: FastifyReply,
  requestId: string,
  processingTime: number,
  aiResponse: ProcessAiResponse,
  lang: string
): void {
  const { thumbnailBase64: _thumbnail, videoBase64: _video, ...rest } = aiResponse;
  const result: AnalysisResult = { ...rest, lang };
  reply.status(200).send({ success: true, requestId, processingTime, result });
}

// POST /api/analyze — Analyse d'un fichier uploadé (multipart/form-data).
export async function analyzeFile(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Lecture des parties multipart : fichier + champs texte (prompt, lang), tout ordre confondu.
  let fileBuffer: Buffer | undefined;
  let mimetype: string | undefined;
  let prompt: string | undefined;
  let lang: string | undefined;

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      mimetype = part.mimetype;
      if (!(env.ALLOWED_MIME_TYPES as readonly string[]).includes(mimetype)) {
        throw new InvalidFileTypeError({ received: mimetype, allowed: env.ALLOWED_MIME_TYPES });
      }
      // La méthode toBuffer() applique la limite de taille (sinon lève FST_REQ_FILE_TOO_LARGE → 413).
      fileBuffer = await part.toBuffer();
    } else if (part.fieldname === 'prompt') {
      prompt = String(part.value);
    } else if (part.fieldname === 'lang') {
      lang = String(part.value);
    }
  }

  if (!fileBuffer || !mimetype) {
    throw new ValidationError('Aucun fichier fourni. Le champ « file » est requis.');
  }

  // Borne de taille par type : vidéo plus permissive (5 min) que image.
  const isVideo = mimetype.startsWith('video/');
  const maxMb = isVideo ? env.MAX_VIDEO_SIZE_MB : env.MAX_FILE_SIZE_MB;
  if (fileBuffer.length > maxMb * 1024 * 1024) {
    throw new FileTooLargeError({ maxMb, received: fileBuffer.length });
  }

  logger.info('Analyse de fichier démarrée.', { requestId, mimetype });

  const aiResponse = await aiService.process({ requestId, fileBuffer, mimetype, prompt, lang });
  const processingTime = Date.now() - startTime;
  const resolvedLang = lang ?? 'fr';

  logger.info('Analyse de fichier terminée.', { requestId, processingTime });
  // Les vidéos originales sont conservées sur disque pour la relecture annotée.
  await persistAnalysis(
    aiResponse,
    isVideo ? 'video' : 'image',
    resolvedLang,
    request.authUser?.id ?? null,
    isVideo ? fileBuffer : null
  );

  sendResult(reply, requestId, processingTime, aiResponse, resolvedLang);
}

// POST /api/analyze/url — Analyse depuis une URL d'image.
export async function analyzeUrl(
  request: FastifyRequest<{ Body: AnalyzeUrlBody }>,
  reply: FastifyReply
): Promise<void> {
  const requestId = uuidv4();
  const startTime = Date.now();
  const { url, prompt, lang } = request.body;

  logger.info('Analyse par URL démarrée.', { requestId, url });

  // URL de plateforme vidéo (YouTube / Twitch) → analyse vidéo complète ; sinon image.
  const isPlatformVideo = isVideoPlatformUrl(url);
  const aiResponse = await aiService.process(
    isPlatformVideo
      ? { requestId, videoUrl: url, prompt, lang }
      : { requestId, imageUrl: url, prompt, lang }
  );
  const processingTime = Date.now() - startTime;
  const resolvedLang = lang ?? 'fr';

  logger.info('Analyse par URL terminée.', { requestId, processingTime });
  const videoBuffer = aiResponse.videoBase64 ? Buffer.from(aiResponse.videoBase64, 'base64') : null;
  await persistAnalysis(
    aiResponse,
    isPlatformVideo ? 'video' : 'image',
    resolvedLang,
    request.authUser?.id ?? null,
    videoBuffer
  );

  sendResult(reply, requestId, processingTime, aiResponse, resolvedLang);
}

// POST /api/analyze/prompt — Analyse textuelle pure (sans média).
export async function analyzePrompt(
  request: FastifyRequest<{ Body: { prompt: string; lang?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const requestId = uuidv4();
  const startTime = Date.now();
  const { prompt, lang } = request.body;

  logger.info('Analyse par prompt démarrée.', { requestId });

  const aiResponse = await aiService.process({ requestId, prompt, lang });
  const processingTime = Date.now() - startTime;
  const resolvedLang = lang ?? 'fr';

  logger.info('Analyse par prompt terminée.', { requestId, processingTime });
  await persistAnalysis(aiResponse, 'prompt', resolvedLang, request.authUser?.id ?? null);

  sendResult(reply, requestId, processingTime, aiResponse, resolvedLang);
}
