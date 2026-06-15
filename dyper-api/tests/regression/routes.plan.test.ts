import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { User } from '../../src/models';
import aiService from '../../src/services/ai/ai.service';
import { connectDatabase } from '../../src/services/db/database.service';
import type { ProcessAiResponse, ProcessOptions } from '../../src/types';
import { type AuthedUser, registerAndLogin } from '../helpers/auth.helper';

let app: FastifyInstance;
let auth: AuthedUser;

function fakeAi(requestId: string): ProcessAiResponse {
  return {
    requestId,
    description: 'Analyse factice.',
    visualization: {
      objects: [],
      scene: { label: 'scène', confidence: 0.5, indoor: null },
      colors: ['#000000'],
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
  auth = await registerAndLogin(app, 'plan@test.dev');
  jest
    .spyOn(aiService, 'process')
    .mockImplementation(async (opts: ProcessOptions) => fakeAi(opts.requestId));
});

afterAll(async () => {
  await app.close();
});

describe('Forfaits & quotas (/api/me)', () => {
  it('GET /api/me/plan — forfait gratuit par défaut avec ses quotas', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/plan', headers: auth.headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.plan).toBe('free');
    expect(body.limits.monthlyAnalyses).toBe(40);
    expect(body.limits.queuePriority).toBe(0);
  });

  it('GET /api/me/usage — consommation initiale à zéro', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/usage', headers: auth.headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.usage.analyses).toBe(0);
    expect(typeof body.resetsAt).toBe('string');
  });

  it('une analyse incrémente le compteur d’usage', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/analyze/prompt',
      headers: auth.headers,
      payload: { prompt: 'que vois-tu ?' },
    });
    const res = await app.inject({ method: 'GET', url: '/api/me/usage', headers: auth.headers });
    expect(res.json().usage.analyses).toBe(1);
  });

  it('POST /api/me/checkout — souscription factice change le forfait et renvoie un reçu', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/checkout',
      headers: auth.headers,
      payload: { plan: 'pro' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.plan).toBe('pro');
    expect(body.limits.monthlyAnalyses).toBe(400);
    expect(body.receipt.paid).toBe(true);
    expect(body.receipt.previousPlan).toBe('free');
  });

  it('POST /api/me/checkout — forfait inconnu rejeté (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/checkout',
      headers: auth.headers,
      payload: { plan: 'platinum' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('quota mensuel atteint → 402 QUOTA_EXCEEDED', async () => {
    // Force le compteur au plafond du forfait pro (400) sur une période active.
    const user = await User.findByPk(auth.userId);
    if (!user) throw new Error('Utilisateur de test introuvable.');
    user.usage_count = 400;
    user.usage_period_start = new Date();
    await user.save();

    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze/prompt',
      headers: auth.headers,
      payload: { prompt: 'encore une' },
    });
    expect(res.statusCode).toBe(402);
    const body = res.json();
    expect(body.error.code).toBe('QUOTA_EXCEEDED');
    expect(body.error.details.reason).toBe('analyses');
  });
});
