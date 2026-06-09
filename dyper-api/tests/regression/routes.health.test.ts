import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import aiService from '../../src/services/ai/ai.service';
import { connectDatabase } from '../../src/services/db/database.service';

let app: FastifyInstance;

beforeAll(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('retourne 200 sans clé applicative quand la base est accessible', async () => {
    jest.spyOn(aiService, 'isHealthy').mockResolvedValue(true);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
    expect(body.ai).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  it('signale ai « unreachable » lorsque dyper-ai est injoignable', async () => {
    jest.spyOn(aiService, 'isHealthy').mockResolvedValue(false);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.json().ai).toBe('unreachable');
  });
});
