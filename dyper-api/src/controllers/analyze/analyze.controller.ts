// Contrôleurs d'analyse — exposent les trois modes : fichier uploadé, URL et prompt textuel.
// Préserve le contrat de réponse Dyper : { success, requestId, processingTime, result }.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { Analysis } from '../../models';
import aiService from '../../services/ai/ai.service';
import { env } from '../../services/env.service';
import logger from '../../services/logger.service';
import type { AnalysisResult, AnalyzeType, ProcessAiResponse } from '../../types';
import { InvalidFileTypeError, ValidationError } from '../../utils/errors';

interface AnalyzeBody {
  prompt?: string;
  lang?: string;
}

interface AnalyzeUrlBody extends AnalyzeBody {
  url: string;
}

// Enregistre l'analyse en base sans bloquer la réponse (une erreur DB est journalisée, pas propagée).
async function persistAnalysis(
  result: ProcessAiResponse,
  type: AnalyzeType,
  lang: string
): Promise<void> {
  try {
    await Analysis.create({
      request_id: result.requestId,
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
    });
  } catch (e) {
    logger.error("Échec de la persistance de l'analyse.", {
      error: e,
      requestId: result.requestId,
    });
  }
}

// Construit l'enveloppe de réponse standard Dyper.
function sendResult(
  reply: FastifyReply,
  requestId: string,
  processingTime: number,
  aiResponse: ProcessAiResponse,
  lang: string
): void {
  const result: AnalysisResult = { ...aiResponse, lang };
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

  logger.info('Analyse de fichier démarrée.', { requestId, mimetype });

  const aiResponse = await aiService.process({ requestId, fileBuffer, mimetype, prompt, lang });
  const processingTime = Date.now() - startTime;
  const resolvedLang = lang ?? 'fr';

  logger.info('Analyse de fichier terminée.', { requestId, processingTime });
  await persistAnalysis(
    aiResponse,
    mimetype.startsWith('video/') ? 'video' : 'image',
    resolvedLang
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

  const aiResponse = await aiService.process({ requestId, imageUrl: url, prompt, lang });
  const processingTime = Date.now() - startTime;
  const resolvedLang = lang ?? 'fr';

  logger.info('Analyse par URL terminée.', { requestId, processingTime });
  await persistAnalysis(aiResponse, 'image', resolvedLang);

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
  await persistAnalysis(aiResponse, 'prompt', resolvedLang);

  sendResult(reply, requestId, processingTime, aiResponse, resolvedLang);
}
