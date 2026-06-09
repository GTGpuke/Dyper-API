import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { connectDatabase } from '../../src/services/db/database.service';

let app: FastifyInstance;
const APP_KEY = 'test-app-key';
const KEY = { 'x-app-key': APP_KEY };

beforeAll(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Authentification (/api/auth)', () => {
  it('inscrit un nouvel utilisateur (201) et pose un cookie de session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: KEY,
      payload: { email: 'alice@test.dev', password: 'password123', displayName: 'Alice' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().user.email).toBe('alice@test.dev');
    expect(res.json().user).not.toHaveProperty('password_hash');
    expect(res.cookies.some((c) => c.name === 'dyper_token')).toBe(true);
  });

  it('refuse une adresse e-mail déjà utilisée (409)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: KEY,
      payload: { email: 'alice@test.dev', password: 'password123' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('rejette un mot de passe trop court (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: KEY,
      payload: { email: 'bob@test.dev', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('connecte avec les bons identifiants (200)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: KEY,
      payload: { email: 'alice@test.dev', password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.cookies.some((c) => c.name === 'dyper_token')).toBe(true);
  });

  it('rejette un mauvais mot de passe (401, message générique)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: KEY,
      payload: { email: 'alice@test.dev', password: 'wrongpassword' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('rejette un e-mail inconnu (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: KEY,
      payload: { email: 'ghost@test.dev', password: 'password123' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/me sans cookie → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: KEY });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/me avec cookie → profil', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: KEY,
      payload: { email: 'alice@test.dev', password: 'password123' },
    });
    const token = login.cookies.find((c) => c.name === 'dyper_token')?.value ?? '';
    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { ...KEY, cookie: `dyper_token=${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe('alice@test.dev');
    expect(res.json().settings).toHaveProperty('appearance');
  });
});
