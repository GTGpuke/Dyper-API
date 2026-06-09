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
    description: "L'image montre une personne.",
    visualization: {
      objects: [{ label: 'person', confidence: 0.9 }],
      scene: { label: 'scène générale', confidence: 0.5, indoor: null },
      colors: ['#000000'],
      text: [],
      tags: ['person'],
    },
    model: 'yolo26l',
    processingTimeMs: 12,
  };
}

beforeAll(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  auth = await registerAndLogin(app, 'analyze@test.dev');
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  jest
    .spyOn(aiService, 'process')
    .mockImplementation(async (opts: ProcessOptions) => fakeAi(opts.requestId));
});

describe('POST /api/analyze/prompt', () => {
  it('refuse l’accès sans header X-App-Key (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze/prompt',
      payload: { prompt: 'bonjour' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_APP_KEY');
  });

  it('retourne l’enveloppe Dyper avec une clé valide', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze/prompt',
      headers: auth.headers,
      payload: { prompt: 'que vois-tu ?' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(typeof body.requestId).toBe('string');
    expect(typeof body.processingTime).toBe('number');
    expect(body.result.description).toContain('personne');
    expect(body.result.lang).toBe('fr');
    expect(body.result.model).toBe('yolo26l');
  });

  it('rejette un corps invalide (prompt manquant) → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze/prompt',
      headers: auth.headers,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/analyze/url', () => {
  it('analyse une URL http(s) valide', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze/url',
      headers: auth.headers,
      payload: { url: 'https://example.com/cat.jpg', lang: 'en' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.lang).toBe('en');
  });

  it('rejette une URL non http(s) → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze/url',
      headers: auth.headers,
      payload: { url: 'ftp://example.com/x' },
    });
    expect(res.statusCode).toBe(400);
  });
});
