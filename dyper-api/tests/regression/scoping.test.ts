import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import aiService from '../../src/services/ai/ai.service';
import { connectDatabase } from '../../src/services/db/database.service';
import type { ProcessAiResponse, ProcessOptions } from '../../src/types';
import { type AuthedUser, registerAndLogin } from '../helpers/auth.helper';

let app: FastifyInstance;
let alice: AuthedUser;
let bob: AuthedUser;

function fakeAi(requestId: string): ProcessAiResponse {
  return {
    requestId,
    description: 'desc',
    visualization: {
      objects: [{ label: 'person', confidence: 0.9 }],
      scene: { label: 'scène', confidence: 0.5, indoor: null },
      colors: ['#000000'],
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
  alice = await registerAndLogin(app, 'alice-scope@test.dev');
  bob = await registerAndLogin(app, 'bob-scope@test.dev');
  jest
    .spyOn(aiService, 'process')
    .mockImplementation(async (opts: ProcessOptions) => fakeAi(opts.requestId));
});

afterAll(async () => {
  await app.close();
});

describe('Cloisonnement des données par utilisateur', () => {
  it("l'historique d'Alice est invisible pour Bob", async () => {
    await app.inject({
      method: 'POST',
      url: '/api/analyze/prompt',
      headers: alice.headers,
      payload: { prompt: 'analyse alice' },
    });

    const listAlice = await app.inject({
      method: 'GET',
      url: '/api/analyses',
      headers: alice.headers,
    });
    expect(listAlice.json().total).toBeGreaterThanOrEqual(1);

    const listBob = await app.inject({ method: 'GET', url: '/api/analyses', headers: bob.headers });
    expect(listBob.json().total).toBe(0);
  });

  it("Bob ne peut pas lire une analyse d'Alice par son id (404, anti-IDOR)", async () => {
    const listAlice = await app.inject({
      method: 'GET',
      url: '/api/analyses',
      headers: alice.headers,
    });
    const item = listAlice.json().data[0];

    const asAlice = await app.inject({
      method: 'GET',
      url: `/api/analyses/${item.id}`,
      headers: alice.headers,
    });
    expect(asAlice.statusCode).toBe(200);

    const asBob = await app.inject({
      method: 'GET',
      url: `/api/analyses/${item.id}`,
      headers: bob.headers,
    });
    expect(asBob.statusCode).toBe(404);
  });

  it("Bob ne peut pas lire l'historique de chat d'une analyse d'Alice (404)", async () => {
    const listAlice = await app.inject({
      method: 'GET',
      url: '/api/analyses',
      headers: alice.headers,
    });
    const requestId = listAlice.json().data[0].request_id;

    const asBob = await app.inject({
      method: 'GET',
      url: `/api/analyses/${requestId}/chat`,
      headers: bob.headers,
    });
    expect(asBob.statusCode).toBe(404);
  });
});
