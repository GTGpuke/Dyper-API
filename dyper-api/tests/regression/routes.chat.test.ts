import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import groqService from '../../src/services/chat/groq.service';
import { connectDatabase } from '../../src/services/db/database.service';
import { type AuthedUser, registerAndLogin } from '../helpers/auth.helper';

let app: FastifyInstance;
let auth: AuthedUser;

// Contexte d'analyse minimal valide pour le corps de /api/chat.
const CONTEXT = {
  description: "L'image montre une personne.",
  visualization: {
    objects: [{ label: 'person', confidence: 0.9 }],
    scene: { label: 'scène générale', confidence: 0.5, indoor: null },
    colors: ['#000000'],
    text: [],
    tags: ['person'],
  },
  model: 'yolo26l',
  requestId: 'req-chat-1',
};

beforeAll(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  auth = await registerAndLogin(app, 'chat@test.dev');
});

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/chat', () => {
  it('refuse l’accès sans header X-App-Key (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { question: 'Combien de personnes ?', context: CONTEXT },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejette un corps invalide (context manquant) → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: auth.headers,
      payload: { question: 'Combien ?' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('retourne 503 CHAT_NOT_CONFIGURED quand GROQ_API_KEY est absente', async () => {
    // GROQ_API_KEY est vide en test (tests/setup.ts) → le client Groq n'est pas instanciable.
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: auth.headers,
      payload: { question: 'Combien de personnes ?', context: CONTEXT },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('CHAT_NOT_CONFIGURED');
  });

  it('retourne la réponse du LLM quand le service est mocké', async () => {
    jest.spyOn(groqService, 'chatWithResult').mockResolvedValue({
      answer: 'Une seule personne est visible.',
      model: 'llama-3.1-8b-instant',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: auth.headers,
      payload: { question: 'Combien de personnes ?', context: CONTEXT, lang: 'fr' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.answer).toContain('personne');
  });
});
