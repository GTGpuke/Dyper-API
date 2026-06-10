// Route de service des miniatures, exposée sous /api/media.
// Scope particulier : authentification par cookie JWT uniquement (sans X-App-Key), car les
// miniatures sont chargées par des balises <img> qui ne peuvent pas envoyer de header custom.
import type { FastifyInstance } from 'fastify';
import { getThumbnail } from '../../controllers/media/media.controller';

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/media/:requestId — miniature JPEG d'une analyse.
  app.get<{ Params: { requestId: string } }>(
    '/:requestId',
    {
      schema: {
        tags: ['Média'],
        summary: "Miniature JPEG d'une analyse (authentification par cookie)",
        params: {
          type: 'object',
          required: ['requestId'],
          properties: { requestId: { type: 'string' } },
        },
      },
    },
    getThumbnail
  );
}
