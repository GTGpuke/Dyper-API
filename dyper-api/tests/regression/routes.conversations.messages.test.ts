import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { Analysis } from '../../src/models';
import aiService from '../../src/services/ai/ai.service';
import groqService from '../../src/services/chat/groq.service';
import { connectDatabase } from '../../src/services/db/database.service';
import type { ProcessAiResponse, ProcessOptions } from '../../src/types';
import { type AuthedUser, registerAndLogin } from '../helpers/auth.helper';
import { buildMultipart } from '../helpers/multipart.helper';

let app: FastifyInstance;
let auth: AuthedUser;

// Pixel JPEG minimal (en-tête uniquement — le contenu importe peu pour les tests d'écriture).
const TINY_JPEG_B64 = Buffer.from('fake-jpeg-bytes').toString('base64');

function fakeAi(opts: ProcessOptions): ProcessAiResponse {
  return {
    requestId: opts.requestId,
    description: 'Une personne et une voiture.',
    visualization: {
      objects: [
        { label: 'person', confidence: 0.9, boundingBox: { x: 1, y: 2, w: 3, h: 4 } },
        { label: 'car', confidence: 0.8 },
      ],
      scene: { label: 'rue', confidence: 0.7, indoor: false },
      colors: ['#101010'],
      text: [],
      tags: ['car', 'person'],
    },
    model: 'yolo26l',
    processingTimeMs: 10,
    thumbnailBase64: TINY_JPEG_B64,
    timeline: [
      { t: 0, labels: ['person'] },
      { t: 1, labels: ['car', 'person'] },
    ],
    sourceWidth: 640,
    sourceHeight: 480,
  };
}

beforeAll(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  auth = await registerAndLogin(app, 'msg@test.dev');
});

afterAll(async () => {
  await app.close();
  fs.rmSync(process.env.MEDIA_DIR as string, { recursive: true, force: true });
});

beforeEach(() => {
  jest.spyOn(aiService, 'process').mockImplementation(async (opts) => fakeAi(opts));
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function newConversation(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: auth.headers,
    payload: {},
  });
  return res.json().conversation.id;
}

describe('Envoi de messages (/api/conversations/:id/messages)', () => {
  it('fichier joint → 2 messages, carte inlinée, miniature écrite sur disque', async () => {
    const id = await newConversation();
    const { payload, contentType } = buildMultipart({
      file: { content: Buffer.from('img'), filename: 'photo.png', contentType: 'image/png' },
      fields: { text: 'Que vois-tu ?', lang: 'fr' },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: { ...auth.headers, 'content-type': contentType },
      payload,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();

    expect(body.messages).toHaveLength(2);
    const [userMsg, assistantMsg] = body.messages;
    expect(userMsg.role).toBe('user');
    expect(userMsg.attachmentName).toBe('photo.png');
    expect(assistantMsg.kind).toBe('analysis');
    expect(assistantMsg.analysis.description).toContain('voiture');
    expect(assistantMsg.analysis.objects).toHaveLength(2);
    expect(assistantMsg.analysis.timeline).toHaveLength(2);
    expect(assistantMsg.analysis.sourceWidth).toBe(640);
    expect(assistantMsg.analysis.thumbnailUrl).toMatch(/^\/api\/media\//);

    // La miniature est réellement écrite dans MEDIA_DIR.
    const row = await Analysis.findOne({
      where: { request_id: assistantMsg.analysis.requestId },
    });
    expect(row?.thumbnail_path).toBeTruthy();
    const onDisk = path.join(process.env.MEDIA_DIR as string, row?.thumbnail_path as string);
    expect(fs.existsSync(onDisk)).toBe(true);

    // Auto-titre : repris du texte du premier message.
    expect(body.conversation.title).toBe('Que vois-tu ?');
  });

  it('auto-titre tronqué à 60 caractères avec une ellipse', async () => {
    const id = await newConversation();
    const longText = 'mot '.repeat(40).trim();
    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { text: longText },
    });
    const title = res.json().conversation.title;
    expect(Array.from(title).length).toBe(60);
    expect(title.endsWith('…')).toBe(true);
  });

  it('texte seul sans analyse antérieure → analyse de prompt (carte)', async () => {
    const id = await newConversation();
    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { text: 'une plage au coucher du soleil' },
    });
    expect(res.statusCode).toBe(201);
    const assistant = res.json().messages[1];
    expect(assistant.kind).toBe('analysis');
    expect(assistant.analysis.type).toBe('prompt');
  });

  it('texte seul avec analyse antérieure → chat non-streamé + ChatExchange', async () => {
    const id = await newConversation();
    // 1) Crée la carte d'analyse.
    await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { url: 'https://example.com/cat.jpg' },
    });
    // 2) Question de suivi : le contexte est reconstruit server-side.
    const chatSpy = jest.spyOn(groqService, 'chatWithResult').mockResolvedValue({
      answer: 'Il y a une personne et une voiture.',
      model: 'llama-3.1-8b-instant',
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { text: 'Combien de personnes ?' },
    });
    expect(res.statusCode).toBe(201);
    const assistant = res.json().messages[1];
    expect(assistant.kind).toBe('text');
    expect(assistant.content).toContain('personne');
    // Le contexte transmis à Groq provient de la ligne persistée (objets complets + timeline).
    const context = chatSpy.mock.calls[0][0].context;
    expect(context.visualization.objects).toHaveLength(2);
    expect(context.timeline).toHaveLength(2);
  });

  it('URL invalide → 400, message vide → 400', async () => {
    const id = await newConversation();
    const badUrl = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { url: 'ftp://example.com/x' },
    });
    expect(badUrl.statusCode).toBe(400);

    const empty = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: {},
    });
    expect(empty.statusCode).toBe(400);
  });

  it('GET conversation → fil ordonné avec analyses inlinées', async () => {
    const id = await newConversation();
    await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { url: 'https://example.com/a.jpg', text: 'analyse ça' },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/conversations/${id}`,
      headers: auth.headers,
    });
    expect(res.statusCode).toBe(200);
    const { messages } = res.json();
    expect(messages).toHaveLength(2);
    expect(messages.map((m: { seq: number }) => m.seq)).toEqual([1, 2]);
    expect(messages[1].analysis).not.toBeNull();
  });

  it('purge totale → conversations supprimées et miniatures effacées du disque', async () => {
    const id = await newConversation();
    const { payload, contentType } = buildMultipart({
      file: { content: Buffer.from('img'), filename: 'purge.png', contentType: 'image/png' },
    });
    const sent = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: { ...auth.headers, 'content-type': contentType },
      payload,
    });
    const row = await Analysis.findOne({
      where: { request_id: sent.json().messages[1].analysis.requestId },
    });
    const onDisk = path.join(process.env.MEDIA_DIR as string, row?.thumbnail_path as string);
    expect(fs.existsSync(onDisk)).toBe(true);

    const purge = await app.inject({
      method: 'DELETE',
      url: '/api/me/history',
      headers: auth.headers,
      payload: {},
    });
    expect(purge.statusCode).toBe(200);

    // Conversation supprimée, miniature effacée du disque.
    const after = await app.inject({
      method: 'GET',
      url: `/api/conversations/${id}`,
      headers: auth.headers,
    });
    expect(after.statusCode).toBe(404);
    expect(fs.existsSync(onDisk)).toBe(false);
  });
});
