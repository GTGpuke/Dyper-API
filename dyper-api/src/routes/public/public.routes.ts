// Routes publiques (sans connexion) du feed « Global », exposées sous /api/public.
// Scope sans authentification : pages et médias partageables hors session, protégés par un slug
// aléatoire non devinable. Le contenu publié est garanti tout public (modération à la publication).
import type { FastifyInstance } from 'fastify';
import {
  getPublicPublication,
  getPublicThumbnail,
  getPublicVideo,
} from '../../controllers/public/public.controller';

const SLUG_PARAMS = {
  type: 'object',
  required: ['slug'],
  properties: { slug: { type: 'string' } },
} as const;

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/public/publications/:slug — publication publique en lecture seule.
  app.get<{ Params: { slug: string } }>(
    '/publications/:slug',
    {
      schema: {
        tags: ['Public'],
        summary: 'Publication publique partageable (sans connexion)',
        params: SLUG_PARAMS,
      },
    },
    getPublicPublication
  );

  // GET /api/public/media/:slug — miniature publique.
  app.get<{ Params: { slug: string } }>(
    '/media/:slug',
    {
      schema: {
        tags: ['Public'],
        summary: "Miniature publique d'une publication",
        params: SLUG_PARAMS,
      },
    },
    getPublicThumbnail
  );

  // GET /api/public/media/:slug/video — vidéo publique en streaming Range.
  app.get<{ Params: { slug: string } }>(
    '/media/:slug/video',
    {
      schema: {
        tags: ['Public'],
        summary: 'Vidéo publique en streaming Range (sans connexion)',
        params: SLUG_PARAMS,
      },
    },
    getPublicVideo
  );
}
