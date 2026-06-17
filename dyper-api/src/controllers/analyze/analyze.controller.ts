// Contrôleurs d'analyse — exposent les trois modes : fichier uploadé, URL et prompt textuel.
// Préserve le contrat de réponse Dyper : { success, requestId, processingTime, result }.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import aiService from '../../services/ai/ai.service';
import { persistAnalysis } from '../../services/analysis/persist.service';
import { acquireSlot, type ReleaseSlot } from '../../services/capacity/capacity.service';
import { env } from '../../services/env.service';
import logger from '../../services/logger.service';
import {
  apiQueuePriority,
  assertApiWithinQuota,
  assertWithinQuota,
  queuePriority,
  recordAnalysisUsage,
  recordApiUsage,
} from '../../services/plan/plan.service';
import type { AnalysisResult, ProcessAiResponse } from '../../types';
import { InvalidFileTypeError, ValidationError } from '../../utils/errors';
import { isVideoPlatformUrl } from '../../utils/videoUrl';

interface AnalyzeBody {
  prompt?: string;
  lang?: string;
}

// Détecte une annulation volontaire (client déconnecté) : AbortError natif ou annulation Axios.
function isAbortError(e: unknown): boolean {
  if (e instanceof Error) {
    const name = e.name.toLowerCase();
    if (name.includes('abort') || name.includes('cancel')) return true;
  }
  return (e as { code?: string } | null)?.code === 'ERR_CANCELED';
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
  // Mode temps réel (démo) : frame de preview — non persistée et hors comptage de quota.
  let realtime = false;
  // Pipeline allégé (détection seule, sans vision LLM ni vocabulaire ouvert) — indépendant de realtime.
  let fast = false;

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
    } else if (part.fieldname === 'realtime') {
      realtime = String(part.value) === 'true';
    } else if (part.fieldname === 'fast') {
      fast = String(part.value) === 'true';
    }
  }

  if (!fileBuffer || !mimetype) {
    throw new ValidationError('Aucun fichier fourni. Le champ « file » est requis.');
  }

  // Quota selon le mode d'authentification : forfait API (clé développeur) ou forfait du site
  // (session). Vérifie la taille de fichier + le volume mensuel autorisé.
  const isVideo = mimetype.startsWith('video/');
  const userId = request.authUser?.id as string;
  const viaApi = request.authVia === 'apikey';
  const priority = viaApi
    ? apiQueuePriority(
        await assertApiWithinQuota(userId, { isVideo, fileBytes: fileBuffer.length })
      )
    : queuePriority(await assertWithinQuota(userId, { isVideo, fileBytes: fileBuffer.length }));

  logger.info('Analyse de fichier démarrée.', { requestId, mimetype, viaApi });

  // Annulation : la déconnexion du client (bouton Stop) interrompt l'appel à dyper-ai.
  const ac = new AbortController();
  request.raw.on('close', () => ac.abort());

  // Allocation de capacité : attend un créneau de calcul (priorité selon le forfait).
  let release: ReleaseSlot | undefined;
  try {
    release = await acquireSlot(priority, ac.signal);
    const aiResponse = await aiService.process({
      requestId,
      fileBuffer,
      mimetype,
      prompt,
      lang,
      fast,
      signal: ac.signal,
    });
    const processingTime = Date.now() - startTime;
    const resolvedLang = lang ?? 'fr';

    logger.info('Analyse de fichier terminée.', { requestId, processingTime });
    // Temps réel : on ne persiste pas la frame et on ne décompte pas le quota (flux de preview
    // continu). Sinon, parcours normal : persistance + comptage d'usage.
    if (!realtime) {
      // Les vidéos originales sont conservées sur disque pour la relecture annotée.
      await persistAnalysis(
        aiResponse,
        isVideo ? 'video' : 'image',
        resolvedLang,
        request.authUser?.id ?? null,
        isVideo ? fileBuffer : null
      );
      if (viaApi) await recordApiUsage(userId);
      else await recordAnalysisUsage(userId, { isVideo, aiResponse });
    }

    sendResult(reply, requestId, processingTime, aiResponse, resolvedLang);
  } catch (e) {
    if (isAbortError(e)) {
      logger.info('Analyse de fichier annulée (client déconnecté).', { requestId });
      return;
    }
    throw e;
  } finally {
    release?.();
  }
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
  // Quota selon le mode d'auth (volume mensuel ; pas de fichier local pour une URL).
  const userId = request.authUser?.id as string;
  const viaApi = request.authVia === 'apikey';
  const priority = viaApi
    ? apiQueuePriority(await assertApiWithinQuota(userId, { isVideo: isPlatformVideo }))
    : queuePriority(await assertWithinQuota(userId, { isVideo: isPlatformVideo }));

  // Annulation : la déconnexion du client (bouton Stop) interrompt l'appel à dyper-ai.
  const ac = new AbortController();
  request.raw.on('close', () => ac.abort());

  // Allocation de capacité : attend un créneau de calcul (priorité selon le forfait).
  let release: ReleaseSlot | undefined;
  try {
    release = await acquireSlot(priority, ac.signal);
    const aiResponse = await aiService.process(
      isPlatformVideo
        ? { requestId, videoUrl: url, prompt, lang, signal: ac.signal }
        : { requestId, imageUrl: url, prompt, lang, signal: ac.signal }
    );
    const processingTime = Date.now() - startTime;
    const resolvedLang = lang ?? 'fr';

    logger.info('Analyse par URL terminée.', { requestId, processingTime });
    const videoBuffer = aiResponse.videoBase64
      ? Buffer.from(aiResponse.videoBase64, 'base64')
      : null;
    await persistAnalysis(
      aiResponse,
      isPlatformVideo ? 'video' : 'image',
      resolvedLang,
      request.authUser?.id ?? null,
      videoBuffer
    );
    if (viaApi) await recordApiUsage(userId);
    else await recordAnalysisUsage(userId, { isVideo: isPlatformVideo, aiResponse });

    sendResult(reply, requestId, processingTime, aiResponse, resolvedLang);
  } catch (e) {
    if (isAbortError(e)) {
      logger.info('Analyse par URL annulée (client déconnecté).', { requestId });
      return;
    }
    throw e;
  } finally {
    release?.();
  }
}

// POST /api/analyze/thumbnail — Miniature d'une vidéo de plateforme (aperçu composer, best-effort).
export async function resolveThumbnail(
  request: FastifyRequest<{ Body: { url: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { url } = request.body;
  // Seules les URLs de plateforme vidéo (YouTube / Twitch) sont résolues ; sinon aucune miniature.
  const thumbnailUrl = isVideoPlatformUrl(url) ? await aiService.resolveThumbnail(url) : null;
  reply.status(200).send({ success: true, thumbnailUrl });
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

  // Quota selon le mode d'auth (volume mensuel d'analyses).
  const userId = request.authUser?.id as string;
  const viaApi = request.authVia === 'apikey';
  const priority = viaApi
    ? apiQueuePriority(await assertApiWithinQuota(userId, { isVideo: false }))
    : queuePriority(await assertWithinQuota(userId, { isVideo: false }));

  // Annulation : la déconnexion du client (bouton Stop) interrompt l'appel à dyper-ai.
  const ac = new AbortController();
  request.raw.on('close', () => ac.abort());

  // Allocation de capacité : attend un créneau de calcul (priorité selon le forfait).
  let release: ReleaseSlot | undefined;
  try {
    release = await acquireSlot(priority, ac.signal);
    const aiResponse = await aiService.process({ requestId, prompt, lang, signal: ac.signal });
    const processingTime = Date.now() - startTime;
    const resolvedLang = lang ?? 'fr';

    logger.info('Analyse par prompt terminée.', { requestId, processingTime });
    await persistAnalysis(aiResponse, 'prompt', resolvedLang, request.authUser?.id ?? null);
    if (viaApi) await recordApiUsage(userId);
    else await recordAnalysisUsage(userId, { isVideo: false, aiResponse });

    sendResult(reply, requestId, processingTime, aiResponse, resolvedLang);
  } catch (e) {
    if (isAbortError(e)) {
      logger.info('Analyse par prompt annulée (client déconnecté).', { requestId });
      return;
    }
    throw e;
  } finally {
    release?.();
  }
}
