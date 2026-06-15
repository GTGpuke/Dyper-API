import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
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
  auth = await registerAndLogin(app, 'versioning@test.dev');
  jest
    .spyOn(aiService, 'process')
    .mockImplementation(async (opts: ProcessOptions) => fakeAi(opts.requestId));
});

afterAll(async () => {
  await app.close();
});

describe('Modernisation API (v1, X-Request-Id, sorties configurables)', () => {
  it('expose la version courante sous /api/v1', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/me/plan', headers: auth.headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().plan).toBe('free');
  });

  it('conserve /api comme alias de compatibilité', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/plan', headers: auth.headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().plan).toBe('free');
  });

  it('renvoie un X-Request-Id sur chaque réponse', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/me/plan', headers: auth.headers });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('réutilise le X-Request-Id fourni par le client', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me/plan',
      headers: { ...auth.headers, 'x-request-id': 'trace-abc-123' },
    });
    expect(res.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('rejette une clé applicative invalide (401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me/plan',
      headers: { 'x-app-key': 'mauvaise-cle', cookie: auth.cookie },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_APP_KEY');
  });

  it('applique la sélection de champs (?fields=) sur la liste des analyses', async () => {
    // Produit une analyse persistée, puis ne demande que id + type.
    await app.inject({
      method: 'POST',
      url: '/api/v1/analyze/prompt',
      headers: auth.headers,
      payload: { prompt: 'bonjour' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analyses?fields=type',
      headers: auth.headers,
    });
    expect(res.statusCode).toBe(200);
    const first = res.json().data[0];
    expect(Object.keys(first).sort()).toEqual(['id', 'type']);
  });
});
