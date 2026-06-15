import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { User } from '../../src/models';
import aiService from '../../src/services/ai/ai.service';
import { connectDatabase } from '../../src/services/db/database.service';
import type { ProcessAiResponse, ProcessOptions } from '../../src/types';
import { type AuthedUser, registerAndLogin } from '../helpers/auth.helper';

const APP_KEY = 'test-app-key';

let app: FastifyInstance;
let auth: AuthedUser;

function fakeAi(requestId: string): ProcessAiResponse {
  return {
    requestId,
    description: 'Analyse factice.',
    visualization: {
      objects: [],
      scene: { label: 'scène', confidence: 0.5, indoor: null },
      colors: [],
      text: [],
      tags: [],
    },
    model: 'yolo26l',
    processingTimeMs: 5,
  };
}

beforeAll(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  auth = await registerAndLogin(app, 'apikeys@test.dev');
  jest
    .spyOn(aiService, 'process')
    .mockImplementation(async (opts: ProcessOptions) => fakeAi(opts.requestId));
});

afterAll(async () => {
  await app.close();
});

describe('Clés API & abonnement API', () => {
  let secret = '';
  let keyId = '';

  it('crée une clé API et renvoie le secret une seule fois', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/me/api-keys',
      headers: auth.headers,
      payload: { name: 'Production' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.key.secret).toMatch(/^dyk_live_[0-9a-f]+$/);
    expect(body.key.prefix.startsWith('dyk_live_')).toBe(true);
    secret = body.key.secret;
    keyId = body.key.id;
  });

  it('liste les clés sans jamais exposer le secret', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me/api-keys',
      headers: auth.headers,
    });
    expect(res.statusCode).toBe(200);
    const key = res.json().keys[0];
    expect(key.prefix.startsWith('dyk_live_')).toBe(true);
    expect(key.secret).toBeUndefined();
  });

  it('authentifie une analyse via la clé API (Authorization: Bearer, sans X-App-Key)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analyze/prompt',
      headers: { authorization: `Bearer ${secret}` },
      payload: { prompt: 'bonjour' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('comptabilise la requête sur le forfait API (et non celui du site)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me/api-usage',
      headers: auth.headers,
    });
    expect(res.json().usage.requests).toBe(1);
    // Le quota du site n'a pas bougé.
    const web = await app.inject({ method: 'GET', url: '/api/v1/me/usage', headers: auth.headers });
    expect(web.json().usage.analyses).toBe(0);
  });

  it('forfait API gratuit par défaut, souscription factice vers « starter »', async () => {
    const plan = await app.inject({
      method: 'GET',
      url: '/api/v1/me/api-plan',
      headers: auth.headers,
    });
    expect(plan.json().plan).toBe('free');
    expect(plan.json().limits.monthlyRequests).toBe(100);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/me/api-checkout',
      headers: auth.headers,
      payload: { plan: 'starter' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().plan).toBe('starter');
    expect(res.json().receipt.paid).toBe(true);
  });

  it('refuse une clé API sur une route réservée à la session (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('rejette une clé API inconnue (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analyze/prompt',
      headers: { authorization: 'Bearer dyk_live_inexistante' },
      payload: { prompt: 'x' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('une clé révoquée n’authentifie plus (401)', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/me/api-keys/${keyId}`,
      headers: auth.headers,
    });
    expect(del.statusCode).toBe(200);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analyze/prompt',
      headers: { authorization: `Bearer ${secret}` },
      payload: { prompt: 'x' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('la connexion par session (X-App-Key + cookie) fonctionne toujours', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analyze/prompt',
      headers: { 'x-app-key': APP_KEY, cookie: auth.cookie },
      payload: { prompt: 'bonjour' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('limite l’API sans abonnement : quota gratuit atteint → 402', async () => {
    // Forfait API gratuit, compteur forcé au plafond (100) sur une période active.
    const user = await User.findByPk(auth.userId);
    if (!user) throw new Error('Utilisateur de test introuvable.');
    user.api_plan = 'free';
    user.api_usage_count = 100;
    user.api_usage_period_start = new Date();
    await user.save();

    // Nouvelle clé (la précédente a été révoquée) puis appel via Bearer.
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/me/api-keys',
      headers: auth.headers,
      payload: { name: 'Quota' },
    });
    const fresh = create.json().key.secret as string;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analyze/prompt',
      headers: { authorization: `Bearer ${fresh}` },
      payload: { prompt: 'x' },
    });
    expect(res.statusCode).toBe(402);
    const body = res.json();
    expect(body.error.code).toBe('QUOTA_EXCEEDED');
    expect(body.error.details.scope).toBe('api');
  });

  it('les tokens achetés prennent le relais au-delà du quota (dépassement)', async () => {
    // L'utilisateur est en « free » au plafond (100) depuis le test précédent. On achète un pack.
    const buy = await app.inject({
      method: 'POST',
      url: '/api/v1/me/api-tokens',
      headers: auth.headers,
      payload: { pack: 'small' },
    });
    expect(buy.statusCode).toBe(200);
    expect(buy.json().tokenBalance).toBe(1000);

    // Nouvelle clé, puis appel : il passe désormais en consommant un token.
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/me/api-keys',
      headers: auth.headers,
      payload: { name: 'Tokens' },
    });
    const fresh = create.json().key.secret as string;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analyze/prompt',
      headers: { authorization: `Bearer ${fresh}` },
      payload: { prompt: 'x' },
    });
    expect(res.statusCode).toBe(200);

    const usage = await app.inject({
      method: 'GET',
      url: '/api/v1/me/api-usage',
      headers: auth.headers,
    });
    expect(usage.json().tokenBalance).toBe(999);
  });

  it('souscrit le forfait API illimité', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/me/api-checkout',
      headers: auth.headers,
      payload: { plan: 'unlimited' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().plan).toBe('unlimited');
    expect(res.json().limits.monthlyRequests).toBe(-1);
  });
});
