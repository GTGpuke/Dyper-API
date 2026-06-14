// Contrôleurs de consultation de l'historique des analyses persistées (lecture paginée façon v2).
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Op } from 'sequelize';
import {
  Analysis,
  ChatExchange,
  Publication,
  PublicationComment,
  PublicationReport,
  PublicationVote,
} from '../../models';
import sequelize from '../../services/db/database.service';
import { deleteMediaFiles } from '../../services/media/media.service';
import { NotFoundError } from '../../utils/errors';

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

  // Cloisonnement : un utilisateur ne voit que ses propres analyses.
  const where: Record<string, unknown> = { user_id: request.authUser?.id };
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
  // La requête filtre directement sur (id, user_id) : une analyse d'un autre utilisateur
  // renvoie le même 404 qu'une analyse inexistante (anti-IDOR, pas de fuite d'existence).
  const analysis = await Analysis.findOne({
    where: { id: request.params.id, user_id: request.authUser?.id },
  });
  if (!analysis) {
    throw new NotFoundError('Analyse introuvable.');
  }
  reply.send({ data: analysis });
}

// GET /api/analyses/:requestId/chat — historique des échanges de chat liés à une analyse.
export async function getChatHistory(
  request: FastifyRequest<{ Params: { requestId: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id;

  // Vérifie d'abord que l'analyse parente appartient bien à l'utilisateur.
  const parent = await Analysis.findOne({
    where: { request_id: request.params.requestId, user_id: userId },
  });
  if (!parent) {
    throw new NotFoundError('Analyse introuvable.');
  }

  const rows = await ChatExchange.findAll({
    where: { analysis_request_id: request.params.requestId, user_id: userId },
    order: [['created_at', 'ASC']],
  });
  reply.send({ data: rows, total: rows.length });
}

// DELETE /api/analyses/:id — supprime une analyse, ses échanges de chat liés et ses médias.
export async function deleteAnalysis(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id;

  // Filtrage direct sur (id, user_id) : même 404 anti-IDOR que la lecture (pas de fuite d'existence).
  const analysis = await Analysis.findOne({
    where: { id: request.params.id, user_id: userId },
  });
  if (!analysis) {
    throw new NotFoundError('Analyse introuvable.');
  }

  // Chemins médias collectés avant la transaction (le disque n'est pas transactionnel).
  const mediaPaths = [analysis.thumbnail_path, analysis.video_path];
  const requestId = analysis.request_id;

  // Supprimer une analyse retire aussi sa publication au feed public (le média part avec).
  const publication = await Publication.findOne({ where: { analysis_id: analysis.id } });
  const publicationCommentIds = publication
    ? (
        await PublicationComment.findAll({
          attributes: ['id'],
          where: { publication_id: publication.id },
        })
      ).map((c) => c.id)
    : [];

  await sequelize.transaction(async (tx) => {
    await ChatExchange.destroy({
      where: { analysis_request_id: requestId, user_id: userId },
      transaction: tx,
    });
    if (publication) {
      await PublicationVote.destroy({ where: { publication_id: publication.id }, transaction: tx });
      await PublicationComment.destroy({
        where: { publication_id: publication.id },
        transaction: tx,
      });
      await PublicationReport.destroy({
        where: { target_id: { [Op.in]: [publication.id, ...publicationCommentIds] } },
        transaction: tx,
      });
      await publication.destroy({ transaction: tx });
    }
    await analysis.destroy({ transaction: tx });
  });

  await deleteMediaFiles(mediaPaths);

  reply.send({ success: true, deleted: 1 });
}
