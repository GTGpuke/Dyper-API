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
import { v4 as uuidv4 } from 'uuid';
import { authenticate, requireSession } from './middlewares/authenticate';
import { verifyAppKey } from './middlewares/verifyAppKey';
import { verifyAuth } from './middlewares/verifyAuth';
import { analysisRoutes } from './routes/analysis/analysis.routes';
import { analyzeRoutes } from './routes/analyze/analyze.routes';
import { authRoutes } from './routes/auth/auth.routes';
import { chatRoutes } from './routes/chat/chat.routes';
import { conversationsRoutes } from './routes/conversations/conversations.routes';
import { globalRoutes } from './routes/global/global.routes';
import { meRoutes } from './routes/me/me.routes';
import { mediaRoutes } from './routes/media/media.routes';
import { publicRoutes } from './routes/public/public.routes';
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
    // Traçabilité de bout en bout : on réutilise un X-Request-Id fourni par l'appelant, sinon on
    // en génère un (UUID). Cet identifiant est renvoyé dans chaque réponse et propagé à dyper-ai.
    requestIdHeader: 'x-request-id',
    genReqId: () => uuidv4(),
    ...opts,
  });

  // Renvoie l'identifiant de requête sur chaque réponse (succès comme erreur) — standard d'API
  // publique pour le support et le débogage corrélé entre services.
  app.addHook('onSend', async (request, reply) => {
    if (!reply.getHeader('X-Request-Id')) reply.header('X-Request-Id', String(request.id));
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
        description: [
          'Passerelle de reconnaissance visuelle multimodale (image / vidéo / prompt).',
          '',
          '**Versionnement** — la version courante est exposée sous `/api/v1`. Le préfixe `/api`',
          'reste pris en charge comme alias de compatibilité (équivalent à la dernière version).',
          '',
          '**Authentification** — chaque requête `/api` exige le header `X-App-Key` ; les routes de',
          'compte exigent en plus une session (cookie httpOnly `dyper_token`).',
          '',
          '**Traçabilité** — toute réponse renvoie un header `X-Request-Id`. Fournissez le vôtre pour',
          'corréler vos journaux ; sinon un identifiant est généré.',
          '',
          '**Limitation de débit** — les réponses portent les en-têtes `x-ratelimit-limit`,',
          '`x-ratelimit-remaining` et `x-ratelimit-reset`. Un dépassement renvoie un code 429.',
        ].join('\n'),
        version: '2.1.0',
        contact: { name: 'Dyper', url: 'https://dyper.app' },
        license: { name: 'Propriétaire' },
      },
      servers: [{ url: '/api/v1', description: 'Version courante' }],
      components: {
        securitySchemes: {
          appKey: { type: 'apiKey', name: 'X-App-Key', in: 'header' },
          sessionCookie: { type: 'apiKey', name: 'dyper_token', in: 'cookie' },
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

    // Montage de l'arborescence API sous un préfixe de base donné. La version courante « /api/v1 »
    // est canonique ; « /api » reste un alias de compatibilité (aucune régression pour les clients
    // existants, dont le frontend). Les deux pointent vers les mêmes contrôleurs.
    const mountApiTree = async (base: string): Promise<void> => {
      // Routes d'authentification : first-party (clé applicative seule, sans session ni clé API),
      // car register/login servent justement à obtenir une session web.
      await apiApp.register(async (authApp) => {
        authApp.addHook('onRequest', verifyAppKey);
        await authApp.register(authRoutes, { prefix: `${base}/auth` });
      });

      // Sous-scope protégé : authentification unifiée — session web (X-App-Key + cookie) OU clé API
      // développeur (Authorization: Bearer dyk_…). request.authVia indique le mode retenu.
      await apiApp.register(async (protectedApp) => {
        protectedApp.addHook('onRequest', authenticate);

        // Surface de l'API publique : accessible par clé API OU par session web.
        await protectedApp.register(analyzeRoutes, { prefix: `${base}/analyze` });
        await protectedApp.register(analysisRoutes, { prefix: `${base}/analyses` });

        // Surface réservée à la session web (gestion de compte, conversations, chat, feed public) :
        // jamais accessible par clé API, même si la requête en porte une.
        await protectedApp.register(async (sessionApp) => {
          sessionApp.addHook('onRequest', requireSession);

          await sessionApp.register(chatRoutes, { prefix: `${base}/chat` });
          await sessionApp.register(meRoutes, { prefix: `${base}/me` });
          await sessionApp.register(conversationsRoutes, { prefix: `${base}/conversations` });
          await sessionApp.register(globalRoutes, { prefix: `${base}/global` });
        });
      });
    };

    await mountApiTree('/api/v1');
    await mountApiTree('/api');
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
    await mediaApp.register(mediaRoutes, { prefix: '/api/v1/media' });
    await mediaApp.register(mediaRoutes, { prefix: '/api/media' });
  });

  // ─── Feed public « Global » (sans authentification) ───────────────────────────
  // Pages et médias partageables hors session, protégés par un slug aléatoire non devinable.
  // Le contenu publié est garanti tout public (modération « tout sensible bloqué » à la publication).
  await app.register(async (publicApp) => {
    await publicApp.register(rateLimit, {
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
    await publicApp.register(publicRoutes, { prefix: '/api/v1/public' });
    await publicApp.register(publicRoutes, { prefix: '/api/public' });
  });

  return app;
}
