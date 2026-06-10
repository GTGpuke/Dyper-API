// Routes des conversations, exposées sous /api/conversations (protégées par verifyAuth en amont).
import type { FastifyInstance } from 'fastify';
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
} from '../../controllers/conversations/conversations.controller';
import { postMessage, streamMessage } from '../../controllers/conversations/messages.controller';

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

export async function conversationsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/conversations — liste paginée (sans messages).
  app.get<{ Querystring: { page?: number; limit?: number } }>(
    '/',
    {
      schema: {
        tags: ['Conversations'],
        summary: "Liste des conversations de l'utilisateur",
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
        },
      },
    },
    listConversations
  );

  // POST /api/conversations — crée une conversation.
  // Pas de schéma de corps : un POST sans corps doit être accepté (le titre est validé manuellement).
  app.post<{ Body: { title?: string } | undefined }>(
    '/',
    { schema: { tags: ['Conversations'], summary: 'Crée une conversation' } },
    createConversation
  );

  // GET /api/conversations/:id — fil complet (analyses inlinées).
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['Conversations'],
        summary: "Détail d'une conversation et de ses messages",
        params: idParam,
      },
    },
    getConversation
  );

  // PATCH /api/conversations/:id — renomme.
  app.patch<{ Params: { id: string }; Body: { title: string } }>(
    '/:id',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Renomme une conversation',
        params: idParam,
        body: {
          type: 'object',
          required: ['title'],
          properties: { title: { type: 'string', minLength: 1, maxLength: 120 } },
        },
      },
    },
    renameConversation
  );

  // DELETE /api/conversations/:id — supprime (messages inclus, analyses conservées).
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Supprime une conversation et ses messages',
        params: idParam,
      },
    },
    deleteConversation
  );

  // POST /api/conversations/:id/messages — envoi d'un message (multipart fichier ou JSON).
  // Pas de schéma de corps : le multipart est lu manuellement (motif des routes /api/analyze).
  app.post<{ Params: { id: string } }>(
    '/:id/messages',
    {
      schema: {
        tags: ['Conversations'],
        summary: "Envoie un message (texte, fichier ou URL) et reçoit la réponse de l'assistant",
        params: idParam,
        consumes: ['multipart/form-data', 'application/json'],
      },
    },
    postMessage
  );

  // POST /api/conversations/:id/messages/stream — question de suivi streamée (SSE).
  app.post<{ Params: { id: string }; Body: { text: string; lang?: string } }>(
    '/:id/messages/stream',
    {
      schema: {
        tags: ['Conversations'],
        summary: 'Pose une question de suivi en streaming SSE (réponse token par token)',
        params: idParam,
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string', minLength: 1, maxLength: 1000 },
            lang: { type: 'string' },
          },
        },
      },
    },
    streamMessage
  );
}
