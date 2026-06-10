import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { Analysis } from '../../src/models';
import { connectDatabase } from '../../src/services/db/database.service';
import { type AuthedUser, registerAndLogin } from '../helpers/auth.helper';

let app: FastifyInstance;
let alice: AuthedUser;
let bob: AuthedUser;

beforeAll(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  alice = await registerAndLogin(app, 'conv-alice@test.dev');
  bob = await registerAndLogin(app, 'conv-bob@test.dev');
});

afterAll(async () => {
  await app.close();
});

async function createConversation(auth: AuthedUser, title?: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: auth.headers,
    payload: title ? { title } : {},
  });
  expect(res.statusCode).toBe(201);
  return res.json().conversation.id;
}

describe('CRUD des conversations (/api/conversations)', () => {
  it('crée une conversation avec le titre par défaut (201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: alice.headers,
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().conversation.title).toBe('Nouvelle conversation');
  });

  it('accepte un POST sans corps ni content-type (201)', async () => {
    // Reproduit un axios.post sans data : aucun corps, aucun content-type.
    const res = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: alice.headers,
    });
    expect(res.statusCode).toBe(201);
  });

  it('refuse un titre de plus de 120 caractères (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: alice.headers,
      payload: { title: 'x'.repeat(121) },
    });
    expect(res.statusCode).toBe(400);
  });

  it('liste les conversations triées par activité, sans les messages', async () => {
    await createConversation(alice, 'Ancienne');
    await createConversation(alice, 'Récente');
    const res = await app.inject({
      method: 'GET',
      url: '/api/conversations',
      headers: alice.headers,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.data[0]).not.toHaveProperty('messages');
    const titles = body.data.map((c: { title: string }) => c.title);
    expect(titles.indexOf('Récente')).toBeLessThan(titles.indexOf('Ancienne'));
  });

  it('renomme une conversation (PATCH)', async () => {
    const id = await createConversation(alice);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/conversations/${id}`,
      headers: alice.headers,
      payload: { title: 'Titre choisi' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().conversation.title).toBe('Titre choisi');
  });

  it('supprime une conversation sans toucher aux analyses', async () => {
    const id = await createConversation(alice);
    const before = await Analysis.count();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/conversations/${id}`,
      headers: alice.headers,
    });
    expect(res.statusCode).toBe(200);
    expect(await Analysis.count()).toBe(before);

    const after = await app.inject({
      method: 'GET',
      url: `/api/conversations/${id}`,
      headers: alice.headers,
    });
    expect(after.statusCode).toBe(404);
  });

  it('cloisonne les conversations entre utilisateurs (anti-IDOR : 404 partout)', async () => {
    const id = await createConversation(alice, 'Privée');

    const get = await app.inject({
      method: 'GET',
      url: `/api/conversations/${id}`,
      headers: bob.headers,
    });
    expect(get.statusCode).toBe(404);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/conversations/${id}`,
      headers: bob.headers,
      payload: { title: 'Volée' },
    });
    expect(patch.statusCode).toBe(404);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/conversations/${id}`,
      headers: bob.headers,
    });
    expect(del.statusCode).toBe(404);

    const post = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: bob.headers,
      payload: { text: 'intrusion' },
    });
    expect(post.statusCode).toBe(404);
  });

  it('exige la clé applicative et la session (401 sans cookie)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/conversations',
      headers: { 'x-app-key': 'test-app-key' },
    });
    expect(res.statusCode).toBe(401);
  });
});
