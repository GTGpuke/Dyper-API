// Contrôleurs CRUD des conversations (toutes les routes sont cloisonnées par utilisateur).
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Op } from 'sequelize';
import { Analysis, ChatExchange, Conversation, Message } from '../../models';
import { cancelConversationAnalysis } from '../../services/conversations/analysis-job.service';
import {
  buildMessageViews,
  findOwnedConversation,
  touchConversation,
} from '../../services/conversations/conversation.service';
import sequelize from '../../services/db/database.service';
import { deleteMediaFiles } from '../../services/media/media.service';
import { ValidationError } from '../../utils/errors';

// GET /api/conversations — liste paginée (sans les messages), triée par activité récente.
export async function listConversations(
  request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
  reply: FastifyReply
): Promise<void> {
  const page = request.query.page ?? 1;
  const limit = request.query.limit ?? 50;

  const { count, rows } = await Conversation.findAndCountAll({
    where: { user_id: request.authUser?.id },
    order: [['updated_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });

  reply.send({ success: true, data: rows.map((c) => c.toPublic()), total: count, page, limit });
}

// POST /api/conversations — crée une conversation (titre optionnel, corps facultatif).
export async function createConversation(
  request: FastifyRequest<{ Body: { title?: string } | undefined }>,
  reply: FastifyReply
): Promise<void> {
  const title = request.body?.title?.trim();
  if (title && Array.from(title).length > 120) {
    throw new ValidationError('Le titre ne peut pas dépasser 120 caractères.');
  }
  const conversation = await Conversation.create({
    user_id: request.authUser?.id as string,
    ...(title ? { title } : {}),
  });
  reply.status(201).send({ success: true, conversation: conversation.toPublic() });
}

// GET /api/conversations/:id — conversation + fil de messages (analyses inlinées).
export async function getConversation(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  const conversation = await findOwnedConversation(request.params.id, userId);

  const messages = await Message.findAll({
    where: { conversation_id: conversation.id },
    order: [['seq', 'ASC']],
  });
  const views = await buildMessageViews(messages, userId);

  reply.send({ success: true, conversation: conversation.toPublic(), messages: views });
}

// PATCH /api/conversations/:id — renomme la conversation.
export async function renameConversation(
  request: FastifyRequest<{ Params: { id: string }; Body: { title: string } }>,
  reply: FastifyReply
): Promise<void> {
  const conversation = await findOwnedConversation(
    request.params.id,
    request.authUser?.id as string
  );
  conversation.title = request.body.title.trim();
  await touchConversation(conversation);
  reply.send({ success: true, conversation: conversation.toPublic() });
}

// DELETE /api/conversations/:id — supprime la conversation et ses messages.
// Les analyses référencées sont conservées (elles restent visibles dans l'historique).
export async function deleteConversation(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  const conversation = await findOwnedConversation(request.params.id, userId);

  // Interrompt une éventuelle analyse en tâche de fond AVANT toute suppression : libère le moteur IA
  // (la requête /process est annulée → dyper-ai s'arrête) et évite que le job écrive dans des lignes
  // en cours de suppression.
  cancelConversationAnalysis(conversation.id);

  // Supprimer une conversation efface aussi ses analyses : lignes d'historique, échanges
  // de chat associés, et fichiers médias (miniatures + vidéos) sur disque.
  const requestIds = (
    await Message.findAll({
      attributes: ['analysis_request_id'],
      where: { conversation_id: conversation.id },
    })
  )
    .map((m) => m.analysis_request_id)
    .filter((id): id is string => Boolean(id));

  // Chemins des médias collectés avant la transaction (le disque n'est pas transactionnel).
  const mediaPaths =
    requestIds.length > 0
      ? (
          await Analysis.findAll({
            attributes: ['thumbnail_path', 'video_path'],
            where: { request_id: { [Op.in]: requestIds }, user_id: userId },
          })
        ).flatMap((a) => [a.thumbnail_path, a.video_path])
      : [];

  await sequelize.transaction(async (tx) => {
    if (requestIds.length > 0) {
      await ChatExchange.destroy({
        where: { analysis_request_id: { [Op.in]: requestIds }, user_id: userId },
        transaction: tx,
      });
      await Analysis.destroy({
        where: { request_id: { [Op.in]: requestIds }, user_id: userId },
        transaction: tx,
      });
    }
    await Message.destroy({ where: { conversation_id: conversation.id }, transaction: tx });
    await conversation.destroy({ transaction: tx });
  });

  await deleteMediaFiles(mediaPaths);

  reply.send({ success: true });
}
