// Routes de consultation de l'historique des analyses, exposées sous /api/analyses.
import type { FastifyInstance } from 'fastify';
import {
  deleteAnalysis,
  getAllAnalyses,
  getAnalysisById,
  getChatHistory,
} from '../../controllers/analysis/analysis.controller';

export async function analysisRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/analyses — liste paginée.
  app.get<{
    Querystring: {
      page?: number;
      limit?: number;
      type?: string;
      sort_by?: string;
      sort_order?: string;
      fields?: string;
    };
  }>(
    '/',
    {
      schema: {
        tags: ['Analyses'],
        summary: "Liste paginée de l'historique des analyses",
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
            type: { type: 'string', enum: ['image', 'video', 'prompt'] },
            sort_by: { type: 'string', enum: ['created_at', 'processing_time_ms', 'type'] },
            sort_order: { type: 'string', enum: ['asc', 'desc'] },
            fields: {
              type: 'string',
              description:
                'Sélection de champs (séparés par des virgules), ex. « id,type,description,created_at ».',
            },
          },
        },
      },
    },
    getAllAnalyses
  );

  // GET /api/analyses/:id — détail d'une analyse.
  app.get<{ Params: { id: string }; Querystring: { fields?: string } }>(
    '/:id',
    {
      schema: {
        tags: ['Analyses'],
        summary: 'Détail d’une analyse par son identifiant',
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        querystring: {
          type: 'object',
          properties: {
            fields: {
              type: 'string',
              description: 'Sélection de champs (séparés par des virgules).',
            },
          },
        },
      },
    },
    getAnalysisById
  );

  // DELETE /api/analyses/:id — supprime une analyse et ses données liées (chat + médias).
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['Analyses'],
        summary: 'Supprime une analyse, ses échanges de chat liés et ses médias',
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      },
    },
    deleteAnalysis
  );

  // GET /api/analyses/:requestId/chat — échanges de chat liés à une analyse.
  app.get<{ Params: { requestId: string } }>(
    '/:requestId/chat',
    {
      schema: {
        tags: ['Analyses'],
        summary: 'Historique des échanges de chat liés à une analyse',
        params: {
          type: 'object',
          required: ['requestId'],
          properties: { requestId: { type: 'string' } },
        },
      },
    },
    getChatHistory
  );
}
