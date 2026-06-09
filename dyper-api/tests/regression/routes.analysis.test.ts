import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import aiService from '../../src/services/ai/ai.service';
import { connectDatabase } from '../../src/services/db/database.service';
import type { ProcessAiResponse, ProcessOptions } from '../../src/types';

let app: FastifyInstance;
const APP_KEY = 'test-app-key';
const HEADERS = { 'x-app-key': APP_KEY };

function fakeAi(requestId: string): ProcessAiResponse {
  return {
    requestId,
    description: 'desc',
    visualization: {
      objects: [{ label: 'person', confidence: 0.9 }],
      scene: { label: 'scène générale', confidence: 0.5, indoor: null },
      colors: ['#111111'],
      text: [],
      tags: ['person'],
    },
    model: 'yolo26l',
    processingTimeMs: 5,
  };
}

beforeAll(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  jest
    .spyOn(aiService, 'process')
    .mockImplementation(async (opts: ProcessOptions) => fakeAi(opts.requestId));
});

afterAll(async () => {
  await app.close();
});

describe('Historique des analyses (/api/analyses)', () => {
  it('persiste une analyse puis la retrouve dans la liste paginée', async () => {
    // Deux analyses sont créées via /api/analyze/prompt (persistance non bloquante).
    await app.inject({
      method: 'POST',
      url: '/api/analyze/prompt',
      headers: HEADERS,
      payload: { prompt: 'un' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/analyze/prompt',
      headers: HEADERS,
      payload: { prompt: 'deux' },
    });

    const res = await app.inject({ method: 'GET', url: '/api/analyses', headers: HEADERS });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.data[0]).toHaveProperty('request_id');
    expect(body.data[0]).toHaveProperty('description');
  });

  it('retourne le détail d’une analyse par son id', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/analyses', headers: HEADERS });
    const id = list.json().data[0].id;
    const res = await app.inject({ method: 'GET', url: `/api/analyses/${id}`, headers: HEADERS });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(id);
  });

  it('retourne 404 pour un identifiant inconnu', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analyses/00000000-0000-0000-0000-000000000000',
      headers: HEADERS,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('exige la clé applicative (401 sans X-App-Key)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analyses' });
    expect(res.statusCode).toBe(401);
  });
});
