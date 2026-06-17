// Routes d'analyse exposées sous /api/analyze.
import type { FastifyInstance } from 'fastify';
import {
  analyzeFile,
  analyzePrompt,
  analyzeUrl,
  resolveThumbnail,
} from '../../controllers/analyze/analyze.controller';
import { env } from '../../services/env.service';

export async function analyzeRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/analyze — fichier uploadé (multipart/form-data : champ « file », + prompt/lang optionnels).
  // Limite de débit relevée (vs globale) pour autoriser le flux TEMPS RÉEL (détection en direct,
  // plusieurs images/seconde) ; les ressources restent bornées par le sémaphore de capacité.
  app.post(
    '/',
    {
      config: { rateLimit: { max: env.ANALYZE_RATE_LIMIT_MAX, timeWindow: '1 minute' } },
      schema: {
        tags: ['Analyze'],
        summary: 'Analyse un fichier (image ou vidéo) uploadé',
        consumes: ['multipart/form-data'],
      },
    },
    analyzeFile
  );

  // POST /api/analyze/url — analyse d'une image accessible par URL.
  app.post<{ Body: { url: string; prompt?: string; lang?: string } }>(
    '/url',
    {
      schema: {
        tags: ['Analyze'],
        summary: 'Analyse une image depuis une URL',
        body: {
          type: 'object',
          required: ['url'],
          additionalProperties: false,
          properties: {
            url: { type: 'string', pattern: '^https?://', maxLength: 2048 },
            prompt: { type: 'string', maxLength: 1000 },
            lang: { type: 'string' },
          },
        },
      },
    },
    analyzeUrl
  );

  // POST /api/analyze/thumbnail — miniature d'une vidéo de plateforme (aperçu, best-effort).
  app.post<{ Body: { url: string } }>(
    '/thumbnail',
    {
      schema: {
        tags: ['Analyze'],
        summary: 'Résout la miniature d’une vidéo de plateforme (aperçu)',
        body: {
          type: 'object',
          required: ['url'],
          additionalProperties: false,
          properties: {
            url: { type: 'string', pattern: '^https?://', maxLength: 2048 },
          },
        },
      },
    },
    resolveThumbnail
  );

  // POST /api/analyze/prompt — analyse d'un prompt textuel seul.
  app.post<{ Body: { prompt: string; lang?: string } }>(
    '/prompt',
    {
      schema: {
        tags: ['Analyze'],
        summary: 'Analyse un prompt textuel seul',
        body: {
          type: 'object',
          required: ['prompt'],
          additionalProperties: false,
          properties: {
            prompt: { type: 'string', minLength: 1, maxLength: 1000 },
            lang: { type: 'string' },
          },
        },
      },
    },
    analyzePrompt
  );
}
