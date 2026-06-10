// Contrôleurs CRUD des conversations (toutes les routes sont cloisonnées par utilisateur).
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Conversation, Message } from '../../models';
import {
  buildMessageViews,
  findOwnedConversation,
  touchConversation,
} from '../../services/conversations/conversation.service';
import sequelize from '../../services/db/database.service';
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
  const conversation = await findOwnedConversation(
    request.params.id,
    request.authUser?.id as string
  );

  await sequelize.transaction(async (tx) => {
    await Message.destroy({ where: { conversation_id: conversation.id }, transaction: tx });
    await conversation.destroy({ transaction: tx });
  });

  reply.send({ success: true });
}
