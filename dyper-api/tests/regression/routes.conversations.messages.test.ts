import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { Analysis, ChatExchange } from '../../src/models';
import aiService from '../../src/services/ai/ai.service';
import groqService from '../../src/services/chat/groq.service';
import { connectDatabase } from '../../src/services/db/database.service';
import type { MessageView, ProcessAiResponse, ProcessOptions } from '../../src/types';
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
    audioTranscript: 'Bonjour à tous.',
    frames: [
      {
        t: 0,
        objects: [
          { label: 'person', confidence: 0.9, boundingBox: { x: 1, y: 2, w: 3, h: 4 }, trackId: 1 },
        ],
      },
    ],
    music: [{ artist: 'Daft Punk', title: 'Around the World', album: null }],
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

// L'analyse tourne en tâche de fond : on sonde la conversation jusqu'à ce que la carte d'analyse
// atteigne un état TERMINAL (« ready » ou « error »), au-delà de « queued »/« pending » (l'IA est
// mockée → quelques ms), puis on renvoie les messages.
async function waitForAnalysis(id: string, timeoutMs = 5000): Promise<MessageView[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/conversations/${id}`,
      headers: auth.headers,
    });
    const messages = res.json().messages as MessageView[];
    const assistant = messages.find((m) => m.role === 'assistant');
    if (assistant && (assistant.status === 'ready' || assistant.status === 'error'))
      return messages;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('Analyse non terminée dans le délai imparti.');
}

// Sonde jusqu'à ce que `count` cartes d'analyse soient à l'état « ready » (cas multi-analyses :
// `waitForAnalysis` s'arrête à la 1re carte prête et laisserait les suivantes tourner en fond).
async function waitForReadyAnalyses(
  id: string,
  count: number,
  timeoutMs = 5000
): Promise<MessageView[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/conversations/${id}`,
      headers: auth.headers,
    });
    const messages = res.json().messages as MessageView[];
    const ready = messages.filter((m) => m.kind === 'analysis' && m.status === 'ready');
    if (ready.length >= count) return messages;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`Les ${count} analyses ne sont pas terminées dans le délai imparti.`);
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

    // Réponse immédiate : carte d'analyse en « queued » (en attente d'un créneau de calcul).
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[0].attachmentName).toBe('photo.png');
    expect(body.messages[1].kind).toBe('analysis');
    expect(body.messages[1].status).toBe('queued');
    expect(body.messages[1].analysis).toBeNull();
    // Auto-titre : repris du texte du premier message (immédiat).
    expect(body.conversation.title).toBe('Que vois-tu ?');

    // Une fois la tâche de fond terminée : carte « ready » avec l'analyse inlinée.
    const messages = await waitForAnalysis(id);
    const assistantMsg = messages[1];
    expect(assistantMsg.status).toBe('ready');
    expect(assistantMsg.analysis?.description).toContain('voiture');
    expect(assistantMsg.analysis?.objects).toHaveLength(2);
    expect(assistantMsg.analysis?.timeline).toHaveLength(2);
    expect(assistantMsg.analysis?.sourceWidth).toBe(640);
    expect(assistantMsg.analysis?.thumbnailUrl).toMatch(/^\/api\/media\//);
    expect(assistantMsg.analysis?.frames).toHaveLength(1);
    expect(assistantMsg.analysis?.frames?.[0].objects[0].trackId).toBe(1);
    expect(assistantMsg.analysis?.music?.[0].title).toBe('Around the World');
    expect(assistantMsg.analysis?.videoUrl).toBeNull();

    // La miniature est réellement écrite dans MEDIA_DIR.
    const row = await Analysis.findOne({
      where: { request_id: assistantMsg.analysis?.requestId },
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
    expect(res.json().messages[1].status).toBe('queued');
    const messages = await waitForAnalysis(id);
    expect(messages[1].kind).toBe('analysis');
    expect(messages[1].analysis?.type).toBe('prompt');
  });

  it('texte seul avec analyse antérieure → chat non-streamé + ChatExchange', async () => {
    const id = await newConversation();
    // 1) Crée la carte d'analyse (tâche de fond) puis attend qu'elle soit prête.
    await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { url: 'https://example.com/cat.jpg' },
    });
    await waitForAnalysis(id);
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
    // Le contexte transmis à Groq provient de la ligne persistée (objets complets, timeline,
    // transcription), et la miniature est jointe : le modèle répond en voyant l'image.
    const params = chatSpy.mock.calls[0][0];
    // Mono-analyse : forme historique `context` + `imageBase64` (inchangée).
    expect(params.context).toBeDefined();
    const ctx = params.context as NonNullable<typeof params.context>;
    expect(ctx.visualization.objects).toHaveLength(2);
    expect(ctx.timeline).toHaveLength(2);
    expect(ctx.audioTranscript).toBe('Bonjour à tous.');
    expect(params.imageBase64).toBe(TINY_JPEG_B64);
  });

  it('deux analyses dans le fil → la question de suivi reçoit TOUS les médias (comparaison)', async () => {
    const id = await newConversation();
    // 1) Deux analyses successives dans la même conversation.
    await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { url: 'https://example.com/a.jpg' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { url: 'https://example.com/b.jpg' },
    });
    // Les DEUX analyses doivent être terminées avant la question (sinon contexte incomplet).
    await waitForReadyAnalyses(id, 2);

    // 2) Question de comparaison : le contexte couvre les DEUX médias (et leurs deux images).
    const chatSpy = jest.spyOn(groqService, 'chatWithResult').mockResolvedValue({
      answer: 'Les deux scènes diffèrent.',
      model: 'llama-3.1-8b-instant',
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { text: 'Compare les deux médias.' },
    });
    expect(res.statusCode).toBe(201);

    const params = chatSpy.mock.calls[0][0];
    // Forme multi-médias : `contexts`/`images` (et non plus `context`/`imageBase64`).
    expect(params.contexts).toHaveLength(2);
    expect(params.images).toHaveLength(2);
    expect(params.context).toBeUndefined();
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
    const messages = await waitForAnalysis(id);
    expect(messages).toHaveLength(2);
    expect(messages.map((m) => m.seq)).toEqual([1, 2]);
    expect(messages[1].analysis).not.toBeNull();
  });

  it('lien YouTube → analyse vidéo par URL et stockage de la vidéo téléchargée', async () => {
    const id = await newConversation();
    // dyper-ai renvoie la vidéo téléchargée en base64 (flux URL de plateforme).
    const ytBytes = Buffer.from('yt-mp4-bytes');
    jest.restoreAllMocks();
    const processSpy = jest.spyOn(aiService, 'process').mockImplementation(async (opts) => ({
      ...fakeAi(opts),
      videoBase64: ytBytes.toString('base64'),
    }));

    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    expect(res.statusCode).toBe(201);

    // La vidéo téléchargée est stockée et exposée au lecteur annoté (après la tâche de fond).
    const messages = await waitForAnalysis(id);
    const analysis = messages[1].analysis;
    if (!analysis) throw new Error('Analyse absente.');

    // La passerelle a routé l'URL vers l'analyse vidéo (videoUrl, pas imageUrl).
    const opts = processSpy.mock.calls[0][0];
    expect(opts.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(opts.imageUrl).toBeUndefined();

    expect(analysis.type).toBe('video');
    expect(analysis.videoUrl).toBe(`/api/media/${analysis.requestId}/video`);
    const onDisk = path.join(process.env.MEDIA_DIR as string, `${analysis.requestId}.mp4`);
    expect(fs.readFileSync(onDisk).equals(ytBytes)).toBe(true);
  });

  it("URL d'image classique → analyse image inchangée (régression)", async () => {
    const id = await newConversation();
    jest.restoreAllMocks();
    const processSpy = jest
      .spyOn(aiService, 'process')
      .mockImplementation(async (opts) => fakeAi(opts));

    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { url: 'https://example.com/photo.jpg' },
    });
    expect(res.statusCode).toBe(201);
    const messages = await waitForAnalysis(id);
    const opts = processSpy.mock.calls[0][0];
    expect(opts.imageUrl).toBe('https://example.com/photo.jpg');
    expect(opts.videoUrl).toBeUndefined();
    expect(messages[1].analysis?.type).toBe('image');
  });

  it('vidéo jointe → fichier conservé sur disque et videoUrl inliné', async () => {
    const id = await newConversation();
    const { payload, contentType } = buildMultipart({
      file: { content: Buffer.from('mp4-bytes'), filename: 'clip.mp4', contentType: 'video/mp4' },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: { ...auth.headers, 'content-type': contentType },
      payload,
    });
    expect(res.statusCode).toBe(201);
    const messages = await waitForAnalysis(id);
    const analysis = messages[1].analysis;
    if (!analysis) throw new Error('Analyse absente.');
    expect(analysis.videoUrl).toBe(`/api/media/${analysis.requestId}/video`);
    const onDisk = path.join(process.env.MEDIA_DIR as string, `${analysis.requestId}.mp4`);
    expect(fs.existsSync(onDisk)).toBe(true);
  });

  it('supprimer une conversation efface ses analyses, chats et médias du disque', async () => {
    const id = await newConversation();
    // 1) Analyse vidéo : miniature + vidéo écrites sur disque.
    const { payload, contentType } = buildMultipart({
      file: { content: Buffer.from('mp4'), filename: 'cascade.mp4', contentType: 'video/mp4' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: { ...auth.headers, 'content-type': contentType },
      payload,
    });
    const requestId = (await waitForAnalysis(id))[1].analysis?.requestId as string;

    // 2) Question de suivi : crée un échange de chat lié à l'analyse.
    jest.spyOn(groqService, 'chatWithResult').mockResolvedValue({
      answer: 'Réponse.',
      model: 'test',
    });
    await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { text: 'Une question ?' },
    });

    const row = await Analysis.findOne({ where: { request_id: requestId } });
    const thumbOnDisk = path.join(process.env.MEDIA_DIR as string, row?.thumbnail_path as string);
    const videoOnDisk = path.join(process.env.MEDIA_DIR as string, row?.video_path as string);
    expect(fs.existsSync(thumbOnDisk)).toBe(true);
    expect(fs.existsSync(videoOnDisk)).toBe(true);

    // 3) Suppression de la conversation → tout disparaît (historique, chats, fichiers).
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/conversations/${id}`,
      headers: auth.headers,
    });
    expect(del.statusCode).toBe(200);
    expect(await Analysis.findOne({ where: { request_id: requestId } })).toBeNull();
    expect(await ChatExchange.count({ where: { analysis_request_id: requestId } })).toBe(0);
    expect(fs.existsSync(thumbOnDisk)).toBe(false);
    expect(fs.existsSync(videoOnDisk)).toBe(false);
  });

  it('analyse en tâche de fond annulable : la carte pending et l’échange sont supprimés', async () => {
    // L'IA « tourne » jusqu'à l'annulation (respecte le signal d'abandon).
    jest.restoreAllMocks();
    jest.spyOn(aiService, 'process').mockImplementation(
      (opts) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () =>
            reject(new DOMException('Analyse annulée.', 'AbortError'))
          );
        })
    );

    const id = await newConversation();
    const post = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { text: 'analyse longue' },
    });
    expect(post.statusCode).toBe(201);
    expect(post.json().messages[1].status).toBe('queued');

    // Annulation explicite (bouton Stop).
    const cancel = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/cancel`,
      headers: auth.headers,
    });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json().cancelled).toBe(true);

    // L'échange (question + carte) disparaît une fois l'abandon traité.
    const start = Date.now();
    let messages: MessageView[] = [];
    while (Date.now() - start < 3000) {
      const r = await app.inject({
        method: 'GET',
        url: `/api/conversations/${id}`,
        headers: auth.headers,
      });
      messages = r.json().messages as MessageView[];
      if (messages.length === 0) break;
      await new Promise((res) => setTimeout(res, 25));
    }
    expect(messages).toHaveLength(0);
  });

  it('suppression de conversation : l’analyse en tâche de fond est annulée (signal abandonné)', async () => {
    jest.restoreAllMocks();
    let captured: AbortSignal | undefined;
    jest.spyOn(aiService, 'process').mockImplementation(
      (opts) =>
        new Promise((_resolve, reject) => {
          captured = opts.signal;
          opts.signal?.addEventListener('abort', () =>
            reject(new DOMException('Analyse annulée.', 'AbortError'))
          );
        })
    );

    const id = await newConversation();
    const post = await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: auth.headers,
      payload: { text: 'analyse longue' },
    });
    expect(post.statusCode).toBe(201);

    // Laisse le job démarrer (acquireSlot + process) avant de supprimer.
    const startWait = Date.now();
    while (!captured && Date.now() - startWait < 1000) {
      await new Promise((res) => setTimeout(res, 10));
    }
    expect(captured).toBeDefined();

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/conversations/${id}`,
      headers: auth.headers,
    });
    expect(del.statusCode).toBe(200);

    // La suppression a interrompu le traitement IA (le signal est abandonné).
    expect(captured?.aborted).toBe(true);

    // La conversation est bien supprimée.
    const gone = await app.inject({
      method: 'GET',
      url: `/api/conversations/${id}`,
      headers: auth.headers,
    });
    expect(gone.statusCode).toBe(404);
  });

  it('purge totale → conversations supprimées, miniatures et vidéos effacées du disque', async () => {
    const id = await newConversation();
    const { payload, contentType } = buildMultipart({
      file: { content: Buffer.from('mp4'), filename: 'purge.mp4', contentType: 'video/mp4' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/conversations/${id}/messages`,
      headers: { ...auth.headers, 'content-type': contentType },
      payload,
    });
    const row = await Analysis.findOne({
      where: { request_id: (await waitForAnalysis(id))[1].analysis?.requestId },
    });
    const thumbOnDisk = path.join(process.env.MEDIA_DIR as string, row?.thumbnail_path as string);
    const videoOnDisk = path.join(process.env.MEDIA_DIR as string, row?.video_path as string);
    expect(fs.existsSync(thumbOnDisk)).toBe(true);
    expect(fs.existsSync(videoOnDisk)).toBe(true);

    const purge = await app.inject({
      method: 'DELETE',
      url: '/api/me/history',
      headers: auth.headers,
      payload: {},
    });
    expect(purge.statusCode).toBe(200);

    // Conversation supprimée, miniature et vidéo effacées du disque.
    const after = await app.inject({
      method: 'GET',
      url: `/api/conversations/${id}`,
      headers: auth.headers,
    });
    expect(after.statusCode).toBe(404);
    expect(fs.existsSync(thumbOnDisk)).toBe(false);
    expect(fs.existsSync(videoOnDisk)).toBe(false);
  });
});
