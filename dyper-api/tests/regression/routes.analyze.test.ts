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

describe('POST /api/analyze/thumbnail', () => {
  it('retourne la miniature résolue pour une URL de plateforme', async () => {
    jest
      .spyOn(aiService, 'resolveThumbnail')
      .mockResolvedValue('https://img.youtube.com/vi/abc/hqdefault.jpg');
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze/thumbnail',
      headers: auth.headers,
      payload: { url: 'https://youtu.be/abc' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.thumbnailUrl).toBe('https://img.youtube.com/vi/abc/hqdefault.jpg');
  });

  it('retourne null sans résoudre pour une URL non-plateforme', async () => {
    const spy = jest.spyOn(aiService, 'resolveThumbnail');
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze/thumbnail',
      headers: auth.headers,
      payload: { url: 'https://example.com/image.jpg' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().thumbnailUrl).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

// Construit un corps multipart/form-data minimal contenant un seul fichier.
function multipartFile(content: Buffer, filename: string, contentType: string) {
  const boundary = '----dypertestboundary';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, content, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('POST /api/analyze (fichier)', () => {
  it('accepte un petit fichier image et retourne le résultat', async () => {
    const { payload, contentType } = multipartFile(Buffer.from('img'), 'photo.png', 'image/png');
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      headers: { ...auth.headers, 'content-type': contentType },
      payload,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('rejette une image dépassant la taille maximale → 413', async () => {
    // 11 Mo > limite image (10 Mo) mais < limite vidéo (100 Mo) : la borne par type doit s'appliquer.
    const big = Buffer.alloc(11 * 1024 * 1024, 0x41);
    const { payload, contentType } = multipartFile(big, 'big.png', 'image/png');
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      headers: { ...auth.headers, 'content-type': contentType },
      payload,
    });
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toBe('FILE_TOO_LARGE');
  });
});
