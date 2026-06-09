// Routes d'analyse exposées sous /api/analyze.
import type { FastifyInstance } from 'fastify';
import {
  analyzeFile,
  analyzePrompt,
  analyzeUrl,
} from '../../controllers/analyze/analyze.controller';

export async function analyzeRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/analyze — fichier uploadé (multipart/form-data : champ « file », + prompt/lang optionnels).
  app.post(
    '/',
    {
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
