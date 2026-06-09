// Route de chat LLM exposée sous /api/chat.
import type { FastifyInstance } from 'fastify';
import { chat } from '../../controllers/chat/chat.controller';

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/chat — question de suivi sur un résultat d'analyse.
  app.post(
    '/',
    {
      schema: {
        tags: ['Chat'],
        summary: 'Pose une question de suivi sur un résultat d’analyse (LLM Groq)',
        body: {
          type: 'object',
          required: ['question', 'context'],
          properties: {
            question: { type: 'string', minLength: 1, maxLength: 1000 },
            lang: { type: 'string' },
            context: {
              type: 'object',
              required: ['description', 'visualization', 'model'],
              additionalProperties: true,
              properties: {
                description: { type: 'string' },
                model: { type: 'string' },
                lang: { type: 'string' },
                requestId: { type: 'string' },
                visualization: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
    },
    chat
  );
}
