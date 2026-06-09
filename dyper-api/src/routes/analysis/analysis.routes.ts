// Routes de consultation de l'historique des analyses, exposées sous /api/analyses.
import type { FastifyInstance } from 'fastify';
import {
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
          },
        },
      },
    },
    getAllAnalyses
  );

  // GET /api/analyses/:id — détail d'une analyse.
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['Analyses'],
        summary: 'Détail d’une analyse par son identifiant',
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      },
    },
    getAnalysisById
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
