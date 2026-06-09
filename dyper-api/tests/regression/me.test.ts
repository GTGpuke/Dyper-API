import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import aiService from '../../src/services/ai/ai.service';
import { connectDatabase } from '../../src/services/db/database.service';
import type { ProcessAiResponse, ProcessOptions } from '../../src/types';
import { type AuthedUser, registerAndLogin } from '../helpers/auth.helper';

let app: FastifyInstance;
let me: AuthedUser;
const APP_KEY = 'test-app-key';

function fakeAi(requestId: string): ProcessAiResponse {
  return {
    requestId,
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
  };
}

beforeAll(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  me = await registerAndLogin(app, 'me@test.dev');
  jest
    .spyOn(aiService, 'process')
    .mockImplementation(async (opts: ProcessOptions) => fakeAi(opts.requestId));
});

afterAll(async () => {
  await app.close();
});

describe('Compte courant (/api/me)', () => {
  it('met à jour le profil', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/profile',
      headers: me.headers,
      payload: { displayName: 'Nouveau Nom', bio: 'Bonjour' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.displayName).toBe('Nouveau Nom');
    expect(res.json().user.bio).toBe('Bonjour');
  });

  it('refuse un changement de mot de passe avec mauvais mot de passe actuel (401)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/password',
      headers: me.headers,
      payload: { currentPassword: 'wrong', newPassword: 'newpassword123' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('change le mot de passe puis permet la connexion avec le nouveau', async () => {
    const change = await app.inject({
      method: 'PATCH',
      url: '/api/me/password',
      headers: me.headers,
      payload: { currentPassword: 'password123', newPassword: 'newpassword123' },
    });
    expect(change.statusCode).toBe(200);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-app-key': APP_KEY },
      payload: { email: 'me@test.dev', password: 'newpassword123' },
    });
    expect(login.statusCode).toBe(200);
  });

  it('enregistre et relit les préférences', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/me/settings',
      headers: me.headers,
      payload: { appearance: { theme: 'dark' }, analysis: { defaultLang: 'en' } },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().settings.appearance.theme).toBe('dark');

    const get = await app.inject({ method: 'GET', url: '/api/me', headers: me.headers });
    expect(get.json().settings.appearance.theme).toBe('dark');
    expect(get.json().settings.analysis.defaultLang).toBe('en');
    // Les valeurs non fournies conservent leur défaut (fusion profonde).
    expect(get.json().settings.appearance.density).toBe('comfortable');
  });

  it('exporte uniquement les données du compte', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/analyze/prompt',
      headers: me.headers,
      payload: { prompt: 'export test' },
    });
    const res = await app.inject({ method: 'GET', url: '/api/me/export', headers: me.headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.email).toBe('me@test.dev');
    expect(Array.isArray(body.analyses)).toBe(true);
    expect(body.analyses.length).toBeGreaterThanOrEqual(1);
  });

  it("purge l'historique du compte", async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/me/history',
      headers: me.headers,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const list = await app.inject({ method: 'GET', url: '/api/analyses', headers: me.headers });
    expect(list.json().total).toBe(0);
  });

  it('supprime le compte puis invalide la session (401)', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: '/api/me/account',
      headers: me.headers,
      payload: { password: 'newpassword123' },
    });
    expect(del.statusCode).toBe(200);

    const after = await app.inject({ method: 'GET', url: '/api/me', headers: me.headers });
    expect(after.statusCode).toBe(401);
  });
});
