import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyServerOptions,
} from 'fastify';
import { verifyAppKey } from './middlewares/verifyAppKey';
import { verifyAuth } from './middlewares/verifyAuth';
import { analysisRoutes } from './routes/analysis/analysis.routes';
import { analyzeRoutes } from './routes/analyze/analyze.routes';
import { authRoutes } from './routes/auth/auth.routes';
import { chatRoutes } from './routes/chat/chat.routes';
import { conversationsRoutes } from './routes/conversations/conversations.routes';
import { meRoutes } from './routes/me/me.routes';
import { mediaRoutes } from './routes/media/media.routes';
import aiService from './services/ai/ai.service';
import sequelize from './services/db/database.service';
import { env } from './services/env.service';
import logger from './services/logger.service';
import {
  AppError,
  type ErrorDetails,
  FileTooLargeError,
  InternalError,
  RateLimitExceededError,
  ValidationError,
} from './utils/errors';

// Émet l'enveloppe d'erreur standard Dyper.
function sendError(
  reply: FastifyReply,
  requestId: string,
  statusCode: number,
  code: string,
  message: string,
  details: ErrorDetails = {}
): void {
  reply.status(statusCode).send({ success: false, requestId, error: { code, message, details } });
}

export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    ajv: { customOptions: { strict: false } },
    ...opts,
  });

  // Tolère un corps JSON vide (POST sans payload, ex. logout) au lieu de lever une 400.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Normalise toutes les erreurs au format Dyper : { success, requestId, error: { code, message, details } }.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const requestId = String(request.id);

    // Erreurs métier Dyper (AppError et sous-classes).
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        logger.error(`Erreur serveur : ${error.message}`, { requestId, code: error.code });
      } else {
        logger.warn(`Erreur client : ${error.message}`, { requestId, code: error.code });
      }
      return sendError(
        reply,
        requestId,
        error.statusCode,
        error.code,
        error.message,
        error.details
      );
    }

    // Erreurs de validation de schéma Fastify : message générique en français,
    // détail technique (anglais) conservé dans details pour le débogage.
    if (error.validation) {
      const e = new ValidationError(undefined, { validation: error.validation });
      return sendError(reply, requestId, e.statusCode, e.code, e.message, e.details);
    }

    // Erreurs @fastify/multipart (taille de fichier, type, etc.).
    const code = (error as { code?: string }).code;
    if (code === 'FST_REQ_FILE_TOO_LARGE') {
      const e = new FileTooLargeError();
      return sendError(reply, requestId, e.statusCode, e.code, e.message, e.details);
    }
    if (typeof code === 'string' && code.startsWith('FST_')) {
      const e = new ValidationError();
      return sendError(reply, requestId, e.statusCode, e.code, e.message);
    }

    // Filet de sécurité : toute autre erreur devient un 500 générique.
    logger.error('Erreur non gérée.', { requestId, error: error.message, stack: error.stack });
    const fallback = new InternalError();
    return sendError(reply, requestId, fallback.statusCode, fallback.code, fallback.message);
  });

  // ─── Sécurité & plugins globaux ───────────────────────────────────────────────
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Key'],
  });

  // L'option contentSecurityPolicy est désactivée pour ne pas bloquer l'UI Swagger en développement.
  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(multipart, {
    limits: {
      // Borne haute (vidéo) ; la limite par type (image vs vidéo) est revérifiée dans le contrôleur.
      fileSize: env.MAX_VIDEO_SIZE_MB * 1024 * 1024,
      files: 1,
    },
  });

  // Cookies + JWT : le token d'authentification est lu depuis le cookie httpOnly « dyper_token ».
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: 'dyper_token', signed: false },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Dyper API',
        description: 'Passerelle de reconnaissance visuelle multimodale (image / vidéo / prompt).',
        version: '2.0.0',
      },
      components: {
        securitySchemes: {
          appKey: { type: 'apiKey', name: 'X-App-Key', in: 'header' },
        },
      },
      security: [{ appKey: [] }],
    },
  });

  // La documentation Swagger est désactivée en production.
  if (!env.isProd) {
    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list' },
    });
  }

  // ─── Health check (hors /api, sans clé applicative) ───────────────────────────
  // Vérifie la base SQLite et la disponibilité de dyper-ai. Utilisé par les orchestrateurs.
  app.get(
    '/health',
    { schema: { tags: ['System'], summary: 'Health check' } },
    async (_req, reply) => {
      let db = 'ok';
      try {
        await sequelize.authenticate();
      } catch {
        db = 'error';
      }
      const ai = (await aiService.isHealthy()) ? 'ok' : 'unreachable';
      const ok = db === 'ok';
      reply.status(ok ? 200 : 503).send({
        status: ok ? 'ok' : 'error',
        uptime: process.uptime(),
        db,
        ai,
      });
    }
  );

  // ─── Routes API (scope protégé par X-App-Key + rate limiting) ─────────────────
  await app.register(async (apiApp) => {
    // Limitation de débit appliquée uniquement aux routes /api (préserve /health et /docs).
    await apiApp.register(rateLimit, {
      max: env.RATE_LIMIT_MAX,
      timeWindow: env.RATE_LIMIT_WINDOW,
      errorResponseBuilder: (request) => {
        const e = new RateLimitExceededError();
        return {
          success: false,
          requestId: String(request.id),
          error: { code: e.code, message: e.message, details: e.details },
        };
      },
    });

    apiApp.addHook('onRequest', verifyAppKey);

    // Routes d'authentification : publiques (clé applicative seule, sans session utilisateur),
    // car register/login servent justement à obtenir une session.
    await apiApp.register(authRoutes, { prefix: '/api/auth' });

    // Sous-scope protégé : exige en plus un JWT valide (verifyAuth attache request.authUser).
    await apiApp.register(async (protectedApp) => {
      protectedApp.addHook('onRequest', verifyAuth);

      await protectedApp.register(analyzeRoutes, { prefix: '/api/analyze' });
      await protectedApp.register(chatRoutes, { prefix: '/api/chat' });
      await protectedApp.register(analysisRoutes, { prefix: '/api/analyses' });
      await protectedApp.register(meRoutes, { prefix: '/api/me' });
      await protectedApp.register(conversationsRoutes, { prefix: '/api/conversations' });
    });
  });

  // ─── Médias (authentification par cookie uniquement) ──────────────────────────
  // Scope volontairement hors X-App-Key : les miniatures sont chargées par des balises <img>
  // qui ne peuvent pas envoyer de header custom. Le cookie JWT httpOnly reste l'authentification
  // réelle, et chaque média est cloisonné par utilisateur dans le contrôleur.
  await app.register(async (mediaApp) => {
    await mediaApp.register(rateLimit, {
      max: env.RATE_LIMIT_MAX,
      timeWindow: env.RATE_LIMIT_WINDOW,
      errorResponseBuilder: (request) => {
        const e = new RateLimitExceededError();
        return {
          success: false,
          requestId: String(request.id),
          error: { code: e.code, message: e.message, details: e.details },
        };
      },
    });
    mediaApp.addHook('onRequest', verifyAuth);
    await mediaApp.register(mediaRoutes, { prefix: '/api/media' });
  });

  return app;
}
