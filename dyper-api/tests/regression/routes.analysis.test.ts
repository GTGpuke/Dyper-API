import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { Analysis, ChatExchange } from '../../src/models';
import aiService from '../../src/services/ai/ai.service';
import { connectDatabase } from '../../src/services/db/database.service';
import type { ProcessAiResponse, ProcessOptions } from '../../src/types';
import { type AuthedUser, registerAndLogin } from '../helpers/auth.helper';

let app: FastifyInstance;
let auth: AuthedUser;

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
  auth = await registerAndLogin(app, 'analysis@test.dev');
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
      headers: auth.headers,
      payload: { prompt: 'un' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/analyze/prompt',
      headers: auth.headers,
      payload: { prompt: 'deux' },
    });

    const res = await app.inject({ method: 'GET', url: '/api/analyses', headers: auth.headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.data[0]).toHaveProperty('request_id');
    expect(body.data[0]).toHaveProperty('description');
  });

  it('retourne le détail d’une analyse par son id', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/analyses', headers: auth.headers });
    const id = list.json().data[0].id;
    const res = await app.inject({
      method: 'GET',
      url: `/api/analyses/${id}`,
      headers: auth.headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(id);
  });

  it('retourne 404 pour un identifiant inconnu', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analyses/00000000-0000-0000-0000-000000000000',
      headers: auth.headers,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('exige la clé applicative (401 sans X-App-Key)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analyses' });
    expect(res.statusCode).toBe(401);
  });
});

describe("Suppression d'une analyse (DELETE /api/analyses/:id)", () => {
  it("supprime l'analyse, ses échanges de chat liés et sa miniature du disque", async () => {
    // Analyse avec miniature : on force le mock à renvoyer une miniature base64 pour cet appel.
    const thumb = Buffer.from('miniature-a-supprimer').toString('base64');
    jest.spyOn(aiService, 'process').mockImplementationOnce(async (opts: ProcessOptions) => ({
      ...fakeAi(opts.requestId),
      thumbnailBase64: thumb,
    }));
    await app.inject({
      method: 'POST',
      url: '/api/analyze/prompt',
      headers: auth.headers,
      payload: { prompt: 'à supprimer' },
    });

    const row = await Analysis.findOne({
      where: { user_id: auth.userId },
      order: [['created_at', 'DESC']],
    });
    if (!row) throw new Error("L'analyse n'a pas été persistée.");
    expect(row.thumbnail_path).toBeTruthy();
    const thumbOnDisk = path.join(process.env.MEDIA_DIR as string, row.thumbnail_path as string);
    expect(fs.existsSync(thumbOnDisk)).toBe(true);

    // Échange de chat lié à l'analyse (doit disparaître avec elle).
    await ChatExchange.create({
      analysis_request_id: row.request_id,
      user_id: row.user_id,
      question: 'Combien ?',
      answer: 'Deux.',
      lang: 'fr',
      model: 'test',
    });

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/analyses/${row.id}`,
      headers: auth.headers,
    });
    expect(del.statusCode).toBe(200);
    expect(del.json()).toEqual({ success: true, deleted: 1 });

    expect(await Analysis.findByPk(row.id)).toBeNull();
    expect(await ChatExchange.count({ where: { analysis_request_id: row.request_id } })).toBe(0);
    expect(fs.existsSync(thumbOnDisk)).toBe(false);
  });

  it("retourne 404 pour l'analyse d'un autre utilisateur sans la supprimer (anti-IDOR)", async () => {
    await app.inject({
      method: 'POST',
      url: '/api/analyze/prompt',
      headers: auth.headers,
      payload: { prompt: 'protégée' },
    });
    const row = await Analysis.findOne({
      where: { user_id: auth.userId },
      order: [['created_at', 'DESC']],
    });
    if (!row) throw new Error("L'analyse n'a pas été persistée.");

    const intrus = await registerAndLogin(app, 'analysis-intrus@test.dev');
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/analyses/${row.id}`,
      headers: intrus.headers,
    });
    expect(del.statusCode).toBe(404);
    expect(del.json().error.code).toBe('NOT_FOUND');
    // L'analyse de la victime est intacte.
    expect(await Analysis.findByPk(row.id)).not.toBeNull();
  });

  it('retourne 404 pour un identifiant inexistant', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: '/api/analyses/00000000-0000-0000-0000-000000000000',
      headers: auth.headers,
    });
    expect(del.statusCode).toBe(404);
  });
});
