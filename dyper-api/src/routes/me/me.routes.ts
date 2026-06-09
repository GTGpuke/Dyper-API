// Routes du compte courant, exposées sous /api/me (protégées par verifyAuth en amont).
import type { FastifyInstance } from 'fastify';
import {
  changePassword,
  deleteAccount,
  exportData,
  getMe,
  getSessions,
  purgeHistory,
  revokeAllSessions,
  updateProfile,
  updateSettings,
} from '../../controllers/me/me.controller';

export async function meRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/me
  app.get(
    '/',
    { schema: { tags: ['Compte'], summary: 'Profil et préférences du compte courant' } },
    getMe
  );

  // PATCH /api/me/profile
  app.patch<{ Body: { displayName?: string; avatarUrl?: string; bio?: string } }>(
    '/profile',
    {
      schema: {
        tags: ['Compte'],
        summary: 'Met à jour le profil',
        body: {
          type: 'object',
          properties: {
            displayName: { type: 'string', maxLength: 80 },
            avatarUrl: { type: 'string', maxLength: 2048 },
            bio: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    updateProfile
  );

  // PATCH /api/me/password
  app.patch<{ Body: { currentPassword: string; newPassword: string } }>(
    '/password',
    {
      schema: {
        tags: ['Compte'],
        summary: 'Change le mot de passe',
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', maxLength: 128 },
            newPassword: { type: 'string', minLength: 8, maxLength: 128 },
          },
        },
      },
    },
    changePassword
  );

  // PUT /api/me/settings
  app.put(
    '/settings',
    {
      schema: {
        tags: ['Compte'],
        summary: 'Met à jour les préférences (apparence, analyse)',
        body: {
          type: 'object',
          additionalProperties: true,
          properties: {
            appearance: { type: 'object', additionalProperties: true },
            analysis: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    updateSettings
  );

  // GET /api/me/sessions
  app.get('/sessions', { schema: { tags: ['Compte'], summary: 'Sessions actives' } }, getSessions);

  // POST /api/me/sessions/revoke-all
  app.post(
    '/sessions/revoke-all',
    { schema: { tags: ['Compte'], summary: 'Déconnecte toutes les autres sessions' } },
    revokeAllSessions
  );

  // GET /api/me/export
  app.get(
    '/export',
    { schema: { tags: ['Compte'], summary: "Exporte toutes les données de l'utilisateur (JSON)" } },
    exportData
  );

  // DELETE /api/me/history
  app.delete<{ Body: { type?: string } }>(
    '/history',
    {
      schema: {
        tags: ['Compte'],
        summary: "Purge l'historique d'analyses",
        body: {
          type: 'object',
          properties: { type: { type: 'string', enum: ['image', 'video', 'prompt'] } },
        },
      },
    },
    purgeHistory
  );

  // DELETE /api/me/account
  app.delete<{ Body: { password: string } }>(
    '/account',
    {
      schema: {
        tags: ['Compte'],
        summary: 'Supprime définitivement le compte et ses données',
        body: {
          type: 'object',
          required: ['password'],
          properties: { password: { type: 'string', maxLength: 128 } },
        },
      },
    },
    deleteAccount
  );
}
