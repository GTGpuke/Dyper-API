// Routes de service des médias, exposées sous /api/media.
// Scope particulier : authentification par cookie JWT uniquement (sans X-App-Key), car les
// balises <img> et <video> ne peuvent pas envoyer de header custom.
import type { FastifyInstance } from 'fastify';
import { getThumbnail, getVideo } from '../../controllers/media/media.controller';

const PARAMS_SCHEMA = {
  type: 'object',
  required: ['requestId'],
  properties: { requestId: { type: 'string' } },
} as const;

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/media/:requestId — miniature JPEG d'une analyse.
  app.get<{ Params: { requestId: string } }>(
    '/:requestId',
    {
      schema: {
        tags: ['Média'],
        summary: "Miniature JPEG d'une analyse (authentification par cookie)",
        params: PARAMS_SCHEMA,
      },
    },
    getThumbnail
  );

  // GET /api/media/:requestId/video — vidéo originale en streaming HTTP Range.
  app.get<{ Params: { requestId: string } }>(
    '/:requestId/video',
    {
      schema: {
        tags: ['Média'],
        summary: "Vidéo originale d'une analyse, streaming Range (authentification par cookie)",
        params: PARAMS_SCHEMA,
      },
    },
    getVideo
  );
}
