// Routes du feed public « Global » (scope protégé : X-App-Key + session), exposées sous /api/global.
import type { FastifyInstance } from 'fastify';
import {
  deleteComment,
  deletePublication,
  getPublication,
  listComments,
  listFeed,
  postComment,
  publishAnalysis,
  reportComment,
  reportPublication,
  votePublication,
} from '../../controllers/global/global.controller';

const ID_PARAMS = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
} as const;

export async function globalRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/global/publish — publie une analyse au feed public.
  app.post<{ Body: { analysisId?: string; caption?: string } }>(
    '/publish',
    { schema: { tags: ['Global'], summary: 'Publie une analyse au feed public' } },
    publishAnalysis
  );

  // GET /api/global — feed paginé (tri populaire / récent / top).
  app.get<{ Querystring: { sort?: string; page?: number } }>(
    '/',
    {
      schema: {
        tags: ['Global'],
        summary: 'Feed public paginé',
        querystring: {
          type: 'object',
          properties: {
            sort: { type: 'string', enum: ['hot', 'new', 'top'] },
            page: { type: 'integer', minimum: 1, default: 1 },
          },
        },
      },
    },
    listFeed
  );

  // GET /api/global/publications/:id — détail d'une publication.
  app.get<{ Params: { id: string } }>(
    '/publications/:id',
    { schema: { tags: ['Global'], summary: "Détail d'une publication", params: ID_PARAMS } },
    getPublication
  );

  // DELETE /api/global/publications/:id — dépublie sa publication.
  app.delete<{ Params: { id: string } }>(
    '/publications/:id',
    { schema: { tags: ['Global'], summary: 'Dépublie une publication', params: ID_PARAMS } },
    deletePublication
  );

  // POST /api/global/publications/:id/vote — vote +1 / -1 / 0.
  app.post<{ Params: { id: string }; Body: { value?: number } }>(
    '/publications/:id/vote',
    { schema: { tags: ['Global'], summary: 'Vote sur une publication', params: ID_PARAMS } },
    votePublication
  );

  // GET /api/global/publications/:id/comments — fil des commentaires.
  app.get<{ Params: { id: string } }>(
    '/publications/:id/comments',
    { schema: { tags: ['Global'], summary: "Commentaires d'une publication", params: ID_PARAMS } },
    listComments
  );

  // POST /api/global/publications/:id/comments — ajoute un commentaire.
  app.post<{ Params: { id: string }; Body: { body?: string; parentId?: string } }>(
    '/publications/:id/comments',
    { schema: { tags: ['Global'], summary: 'Ajoute un commentaire', params: ID_PARAMS } },
    postComment
  );

  // POST /api/global/publications/:id/report — signale une publication.
  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/publications/:id/report',
    { schema: { tags: ['Global'], summary: 'Signale une publication', params: ID_PARAMS } },
    reportPublication
  );

  // DELETE /api/global/comments/:id — supprime son commentaire.
  app.delete<{ Params: { id: string } }>(
    '/comments/:id',
    { schema: { tags: ['Global'], summary: 'Supprime son commentaire', params: ID_PARAMS } },
    deleteComment
  );

  // POST /api/global/comments/:id/report — signale un commentaire.
  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/comments/:id/report',
    { schema: { tags: ['Global'], summary: 'Signale un commentaire', params: ID_PARAMS } },
    reportComment
  );
}
