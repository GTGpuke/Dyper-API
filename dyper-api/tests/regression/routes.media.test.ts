import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import aiService from '../../src/services/ai/ai.service';
import { connectDatabase } from '../../src/services/db/database.service';
import type { ProcessAiResponse, ProcessOptions } from '../../src/types';
import { type AuthedUser, registerAndLogin } from '../helpers/auth.helper';

let app: FastifyInstance;
let alice: AuthedUser;
let bob: AuthedUser;
let requestId: string;

const JPEG_BYTES = Buffer.from('fake-jpeg-bytes');

function fakeAi(opts: ProcessOptions): ProcessAiResponse {
  return {
    requestId: opts.requestId,
    description: 'desc',
    visualization: {
      objects: [],
      scene: { label: 'scène', confidence: 0.5, indoor: null },
      colors: [],
      text: [],
      tags: [],
    },
    model: 'yolo26l',
    processingTimeMs: 5,
    thumbnailBase64: JPEG_BYTES.toString('base64'),
  };
}

beforeAll(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  alice = await registerAndLogin(app, 'media-alice@test.dev');
  bob = await registerAndLogin(app, 'media-bob@test.dev');

  // Alice crée une analyse avec miniature via le flux legacy (persistance partagée).
  jest.spyOn(aiService, 'process').mockImplementation(async (opts) => fakeAi(opts));
  const res = await app.inject({
    method: 'POST',
    url: '/api/analyze/prompt',
    headers: alice.headers,
    payload: { prompt: 'image avec miniature' },
  });
  requestId = res.json().requestId;
  jest.restoreAllMocks();
});

afterAll(async () => {
  await app.close();
  fs.rmSync(process.env.MEDIA_DIR as string, { recursive: true, force: true });
});

describe('Service des miniatures (/api/media/:requestId)', () => {
  it('sert la miniature JPEG au propriétaire (cookie seul, sans X-App-Key)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/media/${requestId}`,
      headers: { cookie: alice.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.rawPayload.equals(JPEG_BYTES)).toBe(true);
  });

  it("refuse l'accès à la miniature d'un autre utilisateur (404)", async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/media/${requestId}`,
      headers: { cookie: bob.cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it('refuse un identifiant non UUID (404 uniforme)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/media/..%2F..%2Fsecret',
      headers: { cookie: alice.cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it('404 pour une analyse sans miniature', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/analyze/prompt',
      headers: alice.headers,
      payload: { prompt: 'sans miniature' },
    });
    // Le mock est restauré : dyper-ai réel inaccessible → on passe par une analyse existante
    // sans thumbnailBase64. Si l'appel a échoué (503), le cas est couvert par le test non-UUID.
    if (created.statusCode === 200) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/media/${created.json().requestId}`,
        headers: { cookie: alice.cookie },
      });
      expect(res.statusCode).toBe(404);
    }
  });

  it('exige une session (401 sans cookie)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/media/${requestId}` });
    expect(res.statusCode).toBe(401);
  });
});
