// Routes d'authentification, exposées sous /api/auth (publiques : clé applicative seule).
import type { FastifyInstance } from 'fastify';
import { login, logout, register } from '../../controllers/auth/auth.controller';

// Limite stricte sur les routes sensibles (anti force brute), en plus du rate-limit global.
const AUTH_RATE_LIMIT = { max: 10, timeWindow: '1 minute' };

const emailSchema = { type: 'string', format: 'email', maxLength: 254 };
const passwordSchema = { type: 'string', minLength: 8, maxLength: 128 };

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/auth/register
  app.post<{ Body: { email: string; password: string; displayName?: string } }>(
    '/register',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        tags: ['Auth'],
        summary: 'Crée un compte utilisateur et ouvre une session',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: emailSchema,
            password: passwordSchema,
            displayName: { type: 'string', maxLength: 80 },
          },
        },
      },
    },
    register
  );

  // POST /api/auth/login
  app.post<{ Body: { email: string; password: string } }>(
    '/login',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        tags: ['Auth'],
        summary: 'Authentifie un utilisateur et ouvre une session',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: { email: emailSchema, password: { type: 'string', maxLength: 128 } },
        },
      },
    },
    login
  );

  // POST /api/auth/logout
  app.post(
    '/logout',
    { schema: { tags: ['Auth'], summary: 'Ferme la session (efface le cookie)' } },
    logout
  );
}
