// Routes du compte courant, exposées sous /api/me (protégées par verifyAuth en amont).
import type { FastifyInstance } from 'fastify';
import {
  apiCheckout,
  buyApiTokens,
  changePassword,
  checkout,
  deleteAccount,
  deleteApiKey,
  exportData,
  getApiKeys,
  getApiPlan,
  getApiUsage,
  getCapacity,
  getMe,
  getPlan,
  getSessions,
  getUsage,
  postApiKey,
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

  // GET /api/me/plan
  app.get(
    '/plan',
    { schema: { tags: ['Abonnement'], summary: 'Forfait courant et quotas associés' } },
    getPlan
  );

  // GET /api/me/usage
  app.get(
    '/usage',
    { schema: { tags: ['Abonnement'], summary: 'Consommation mensuelle courante' } },
    getUsage
  );

  // POST /api/me/checkout — souscription d'un forfait (paiement factice).
  app.post<{ Body: { plan: string } }>(
    '/checkout',
    {
      schema: {
        tags: ['Abonnement'],
        summary: 'Souscrit un forfait (paiement factice, sans facturation réelle)',
        body: {
          type: 'object',
          required: ['plan'],
          properties: { plan: { type: 'string', enum: ['free', 'pro', 'studio'] } },
        },
      },
    },
    checkout
  );

  // GET /api/me/capacity
  app.get(
    '/capacity',
    {
      schema: {
        tags: ['Abonnement'],
        summary: 'Charge courante de la passerelle (file de calcul)',
      },
    },
    getCapacity
  );

  // ─── API publique : abonnement développeur + clés (distinct du forfait du site) ───
  // GET /api/me/api-plan
  app.get(
    '/api-plan',
    { schema: { tags: ['API'], summary: "Forfait de l'API publique et quotas associés" } },
    getApiPlan
  );

  // GET /api/me/api-usage
  app.get(
    '/api-usage',
    { schema: { tags: ['API'], summary: "Consommation mensuelle de l'API" } },
    getApiUsage
  );

  // POST /api/me/api-checkout — souscription d'un forfait API (paiement factice).
  app.post<{ Body: { plan: string } }>(
    '/api-checkout',
    {
      schema: {
        tags: ['API'],
        summary: 'Souscrit un forfait API (paiement factice)',
        body: {
          type: 'object',
          required: ['plan'],
          properties: {
            plan: { type: 'string', enum: ['free', 'starter', 'business', 'unlimited'] },
          },
        },
      },
    },
    apiCheckout
  );

  // POST /api/me/api-tokens — achat d'un pack de tokens (paiement factice).
  app.post<{ Body: { pack: string } }>(
    '/api-tokens',
    {
      schema: {
        tags: ['API'],
        summary: 'Achète un pack de tokens API (crédits de dépassement, paiement factice)',
        body: {
          type: 'object',
          required: ['pack'],
          properties: { pack: { type: 'string', enum: ['small', 'medium', 'large'] } },
        },
      },
    },
    buyApiTokens
  );

  // GET /api/me/api-keys
  app.get(
    '/api-keys',
    { schema: { tags: ['API'], summary: 'Liste des clés API actives' } },
    getApiKeys
  );

  // POST /api/me/api-keys — crée une clé (secret renvoyé une seule fois).
  app.post<{ Body: { name?: string } }>(
    '/api-keys',
    {
      schema: {
        tags: ['API'],
        summary: 'Crée une clé API (le secret n’est montré qu’une fois)',
        body: { type: 'object', properties: { name: { type: 'string', maxLength: 80 } } },
      },
    },
    postApiKey
  );

  // DELETE /api/me/api-keys/:id — révoque une clé.
  app.delete<{ Params: { id: string } }>(
    '/api-keys/:id',
    {
      schema: {
        tags: ['API'],
        summary: 'Révoque une clé API',
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      },
    },
    deleteApiKey
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
