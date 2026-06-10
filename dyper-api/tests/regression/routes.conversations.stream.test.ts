import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { ChatExchange, Message } from '../../src/models';
import aiService from '../../src/services/ai/ai.service';
import groqService from '../../src/services/chat/groq.service';
import { connectDatabase } from '../../src/services/db/database.service';
import type { ProcessAiResponse, ProcessOptions } from '../../src/types';
import { type AuthedUser, registerAndLogin } from '../helpers/auth.helper';

let app: FastifyInstance;
let auth: AuthedUser;

function fakeAi(opts: ProcessOptions): ProcessAiResponse {
  return {
    requestId: opts.requestId,
    description: 'desc',
    visualization: {
      objects: [{ label: 'person', confidence: 0.9 }],
      scene: { label: 'rue', confidence: 0.7, indoor: false },
      colors: ['#000000'],
      text: [],
      tags: ['person'],
    },
    model: 'yolo26l',
    processingTimeMs: 5,
  };
}

// Faux flux Groq : async-itérable de 3 deltas, avec un AbortController comme le vrai client.
function fakeGroqStream(deltas: string[]) {
  return {
    controller: new AbortController(),
    async *[Symbol.asyncIterator]() {
      for (const delta of deltas) {
        yield { choices: [{ delta: { content: delta } }] };
      }
    },
  };
}

beforeAll(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  auth = await registerAndLogin(app, 'stream@test.dev');
});

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function conversationWithAnalysis(): Promise<string> {
  jest.spyOn(aiService, 'process').mockImplementation(async (opts) => fakeAi(opts));
  const res = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: auth.headers,
    payload: {},
  });
  const id = res.json().conversation.id;
  await app.inject({
    method: 'POST',
    url: `/api/conversations/${id}/messages`,
    headers: auth.headers,
    payload: { url: 'https://example.com/x.jpg' },
  });
  return id;
}

describe('Streaming SSE (/api/conversations/:id/messages/stream)', () => {
  it('conversation inconnue → 404 JSON standard (avant tout octet SSE)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/conversations/00000000-0000-4000-8000-000000000000/messages/stream',
      headers: auth.headers,
      payload: { text: 'question' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('GROQ_API_KEY absente → 503 CHAT_NOT_CONFIGURED en JSON propre', async () => {
    const id = await conversationWithAnalysis();
    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages/stream`,
      headers: auth.headers,
      payload: { text: 'question' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('CHAT_NOT_CONFIGURED');
  });

  it('conversation sans analyse → 400 (le client doit utiliser le endpoint non-streamé)', async () => {
    jest.spyOn(groqService, 'assertConfigured').mockImplementation(() => undefined);
    const created = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: auth.headers,
      payload: {},
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${created.json().conversation.id}/messages/stream`,
      headers: auth.headers,
      payload: { text: 'question' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('flux nominal : deltas SSE + event done + persistance complète', async () => {
    const id = await conversationWithAnalysis();
    jest.spyOn(groqService, 'assertConfigured').mockImplementation(() => undefined);
    jest.spyOn(groqService, 'streamChatWithResult').mockResolvedValue({
      // biome-ignore lint/suspicious/noExplicitAny: flux simulé structurellement compatible.
      stream: fakeGroqStream(['Une ', 'personne ', 'visible.']) as any,
      model: 'llama-3.1-8b-instant',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages/stream`,
      headers: auth.headers,
      payload: { text: 'Combien de personnes ?', lang: 'fr' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    // Frames de deltas puis frame terminal.
    expect(res.body).toContain('data: {"delta":"Une "}');
    expect(res.body).toContain('data: {"delta":"personne "}');
    expect(res.body).toContain('event: done');

    // Persistance : message user + message assistant complet + échange legacy.
    const messages = await Message.findAll({
      where: { conversation_id: id },
      order: [['seq', 'ASC']],
    });
    const last = messages[messages.length - 1];
    expect(last.role).toBe('assistant');
    expect(last.content).toBe('Une personne visible.');
    const exchange = await ChatExchange.findOne({
      where: { question: 'Combien de personnes ?' },
    });
    expect(exchange?.answer).toBe('Une personne visible.');
  });

  it('erreur Groq en cours de flux → event error (sans crash)', async () => {
    const id = await conversationWithAnalysis();
    jest.spyOn(groqService, 'assertConfigured').mockImplementation(() => undefined);
    const failing = {
      controller: new AbortController(),
      // biome-ignore lint/correctness/useYield: le flux échoue avant le premier delta.
      async *[Symbol.asyncIterator]() {
        throw new Error('panne du fournisseur');
      },
    };
    jest.spyOn(groqService, 'streamChatWithResult').mockResolvedValue({
      // biome-ignore lint/suspicious/noExplicitAny: flux simulé structurellement compatible.
      stream: failing as any,
      model: 'llama-3.1-8b-instant',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages/stream`,
      headers: auth.headers,
      payload: { text: 'question' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('event: error');
    expect(res.body).toContain('CHAT_PROCESSING_ERROR');
  });
});
