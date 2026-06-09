// Contrôleurs de consultation de l'historique des analyses persistées (lecture paginée façon v2).
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Analysis, ChatExchange } from '../../models';
import { AppError } from '../../utils/errors';

// Colonnes triables autorisées (évite l'injection via sort_by).
const SORTABLE_COLUMNS: Record<string, string> = {
  created_at: 'created_at',
  processing_time_ms: 'processing_time_ms',
  type: 'type',
};

// GET /api/analyses — liste paginée de l'historique des analyses.
export async function getAllAnalyses(
  request: FastifyRequest<{
    Querystring: {
      page?: number;
      limit?: number;
      type?: string;
      sort_by?: string;
      sort_order?: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  const page = request.query.page ?? 1;
  const limit = request.query.limit ?? 50;
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (request.query.type) where.type = request.query.type;

  const sortColumn = SORTABLE_COLUMNS[request.query.sort_by ?? ''] ?? 'created_at';
  const sortOrder = request.query.sort_order === 'asc' ? 'ASC' : 'DESC';

  const { count, rows } = await Analysis.findAndCountAll({
    where,
    order: [[sortColumn, sortOrder]],
    limit,
    offset,
  });

  reply.send({ data: rows, total: count, page, limit });
}

// GET /api/analyses/:id — détail d'une analyse par son identifiant.
export async function getAnalysisById(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const analysis = await Analysis.findByPk(request.params.id);
  if (!analysis) {
    throw new AppError('Analyse introuvable.', 'NOT_FOUND', 404);
  }
  reply.send({ data: analysis });
}

// GET /api/analyses/:requestId/chat — historique des échanges de chat liés à une analyse.
export async function getChatHistory(
  request: FastifyRequest<{ Params: { requestId: string } }>,
  reply: FastifyReply
): Promise<void> {
  const rows = await ChatExchange.findAll({
    where: { analysis_request_id: request.params.requestId },
    order: [['created_at', 'ASC']],
  });
  reply.send({ data: rows, total: rows.length });
}
