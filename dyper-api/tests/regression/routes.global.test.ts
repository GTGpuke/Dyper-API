import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { Analysis, Publication } from '../../src/models';
import aiService from '../../src/services/ai/ai.service';
import { connectDatabase } from '../../src/services/db/database.service';
import type { ProcessAiResponse, ProcessOptions } from '../../src/types';
import { type AuthedUser, registerAndLogin } from '../helpers/auth.helper';
import { buildMultipart } from '../helpers/multipart.helper';

let app: FastifyInstance;
let author: AuthedUser;
let other: AuthedUser;

const THUMB = Buffer.from('thumb-bytes').toString('base64');

function fakeAi(opts: ProcessOptions): ProcessAiResponse {
  return {
    requestId: opts.requestId,
    description: 'Une rue avec une personne.',
    visualization: {
      objects: [{ label: 'person', confidence: 0.9 }],
      scene: { label: 'rue', confidence: 0.7, indoor: false },
      colors: ['#101010'],
      text: [],
      tags: ['person'],
    },
    model: 'yolo26l',
    processingTimeMs: 8,
    thumbnailBase64: THUMB,
  };
}

// Crée une analyse image (avec miniature) appartenant à `auth` et renvoie sa ligne persistée.
async function createAnalysis(auth: AuthedUser): Promise<Analysis> {
  const { payload, contentType } = buildMultipart({
    file: { content: Buffer.from('img'), filename: 'photo.png', contentType: 'image/png' },
    fields: { lang: 'fr' },
  });
  await app.inject({
    method: 'POST',
    url: '/api/analyze',
    headers: { ...auth.headers, 'content-type': contentType },
    payload,
  });
  const row = await Analysis.findOne({
    where: { user_id: auth.userId },
    order: [['created_at', 'DESC']],
  });
  if (!row) throw new Error("L'analyse n'a pas été persistée.");
  return row;
}

async function publish(auth: AuthedUser, analysisId: string, caption?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/global/publish',
    headers: auth.headers,
    payload: { analysisId, caption },
  });
}

beforeAll(async () => {
  await connectDatabase();
  app = await buildApp();
  await app.ready();
  author = await registerAndLogin(app, 'global-author@test.dev');
  other = await registerAndLogin(app, 'global-other@test.dev');
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  jest.spyOn(aiService, 'process').mockImplementation(async (opts) => fakeAi(opts));
  jest.spyOn(aiService, 'moderateImage').mockResolvedValue({ available: true, rating: 'safe' });
  jest.spyOn(aiService, 'moderateText').mockResolvedValue({ available: true, rating: 'safe' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Publication au feed Global (POST /api/global/publish)', () => {
  it('publie une analyse sûre et la liste dans le feed', async () => {
    const analysis = await createAnalysis(author);
    const res = await publish(author, analysis.id, 'Ma première analyse');
    expect(res.statusCode).toBe(201);
    const { publication } = res.json();
    expect(publication.slug).toBeTruthy();
    expect(publication.caption).toBe('Ma première analyse');
    expect(publication.author.name).toBeTruthy();

    const feed = await app.inject({ method: 'GET', url: '/api/global', headers: author.headers });
    expect(feed.statusCode).toBe(200);
    const ids = feed.json().data.map((p: { slug: string }) => p.slug);
    expect(ids).toContain(publication.slug);
  });

  it('bloque un contenu jugé explicite (422 NSFW_CONTENT_BLOCKED)', async () => {
    jest
      .spyOn(aiService, 'moderateImage')
      .mockResolvedValue({ available: true, rating: 'explicit' });
    const analysis = await createAnalysis(author);
    const res = await publish(author, analysis.id);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('NSFW_CONTENT_BLOCKED');
  });

  it('bloque quand la modération est indisponible (503)', async () => {
    jest.spyOn(aiService, 'moderateImage').mockResolvedValue({ available: false, rating: null });
    const analysis = await createAnalysis(author);
    const res = await publish(author, analysis.id);
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('MODERATION_UNAVAILABLE');
  });

  it("refuse de publier l'analyse d'un autre utilisateur (404)", async () => {
    const analysis = await createAnalysis(author);
    const res = await publish(other, analysis.id);
    expect(res.statusCode).toBe(404);
  });
});

describe('Votes (POST /api/global/publications/:id/vote)', () => {
  it('applique et retire un vote en recalculant le score', async () => {
    const analysis = await createAnalysis(author);
    const pubId = (await publish(author, analysis.id)).json().publication.id;

    const up = await app.inject({
      method: 'POST',
      url: `/api/global/publications/${pubId}/vote`,
      headers: other.headers,
      payload: { value: 1 },
    });
    expect(up.statusCode).toBe(200);
    expect(up.json().score).toBe(1);

    const clear = await app.inject({
      method: 'POST',
      url: `/api/global/publications/${pubId}/vote`,
      headers: other.headers,
      payload: { value: 0 },
    });
    expect(clear.json().score).toBe(0);
  });
});

describe('Commentaires (/api/global/publications/:id/comments)', () => {
  it('accepte un commentaire sain, refuse un commentaire toxique, gère le fil', async () => {
    const analysis = await createAnalysis(author);
    const pubId = (await publish(author, analysis.id)).json().publication.id;

    const ok = await app.inject({
      method: 'POST',
      url: `/api/global/publications/${pubId}/comments`,
      headers: other.headers,
      payload: { body: 'Superbe analyse !' },
    });
    expect(ok.statusCode).toBe(201);
    const parentId = ok.json().comment.id;

    // Réponse (fil) au commentaire.
    const reply = await app.inject({
      method: 'POST',
      url: `/api/global/publications/${pubId}/comments`,
      headers: author.headers,
      payload: { body: 'Merci !', parentId },
    });
    expect(reply.statusCode).toBe(201);
    expect(reply.json().comment.parentId).toBe(parentId);

    // Commentaire toxique rejeté.
    jest.spyOn(aiService, 'moderateText').mockResolvedValue({ available: true, rating: 'toxic' });
    const toxic = await app.inject({
      method: 'POST',
      url: `/api/global/publications/${pubId}/comments`,
      headers: other.headers,
      payload: { body: 'contenu haineux' },
    });
    expect(toxic.statusCode).toBe(422);
    expect(toxic.json().error.code).toBe('COMMENT_REJECTED');

    const list = await app.inject({
      method: 'GET',
      url: `/api/global/publications/${pubId}/comments`,
      headers: author.headers,
    });
    expect(list.json().total).toBe(2);
  });
});

describe('Gestion & modération communautaire', () => {
  it("interdit de dépublier la publication d'autrui (404)", async () => {
    const analysis = await createAnalysis(author);
    const pubId = (await publish(author, analysis.id)).json().publication.id;
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/global/publications/${pubId}`,
      headers: other.headers,
    });
    expect(res.statusCode).toBe(404);
    expect(await Publication.findByPk(pubId)).not.toBeNull();
  });

  it('auto-masque une publication au-delà du seuil de signalements', async () => {
    const analysis = await createAnalysis(author);
    const pub = (await publish(author, analysis.id)).json().publication;

    const reporters = [
      await registerAndLogin(app, 'reporter1@test.dev'),
      await registerAndLogin(app, 'reporter2@test.dev'),
      await registerAndLogin(app, 'reporter3@test.dev'),
    ];
    for (const reporter of reporters) {
      await app.inject({
        method: 'POST',
        url: `/api/global/publications/${pub.id}/report`,
        headers: reporter.headers,
        payload: { reason: 'spam' },
      });
    }

    // Masquée : absente du feed et 404 sur la page publique.
    const feed = await app.inject({ method: 'GET', url: '/api/global', headers: author.headers });
    expect(feed.json().data.map((p: { id: string }) => p.id)).not.toContain(pub.id);
    const pub404 = await app.inject({ method: 'GET', url: `/api/public/publications/${pub.slug}` });
    expect(pub404.statusCode).toBe(404);
  });
});

describe('Pages publiques (sans connexion, /api/public)', () => {
  it('expose une publication et sa miniature par slug, 404 si inconnu', async () => {
    const analysis = await createAnalysis(author);
    const pub = (await publish(author, analysis.id)).json().publication;

    // Aucune session/clé : la page publique répond.
    const pubRes = await app.inject({ method: 'GET', url: `/api/public/publications/${pub.slug}` });
    expect(pubRes.statusCode).toBe(200);
    expect(pubRes.json().publication.slug).toBe(pub.slug);
    expect(Array.isArray(pubRes.json().comments)).toBe(true);

    const media = await app.inject({ method: 'GET', url: `/api/public/media/${pub.slug}` });
    expect(media.statusCode).toBe(200);
    expect(media.headers['content-type']).toContain('image/jpeg');

    const unknown = await app.inject({
      method: 'GET',
      url: '/api/public/publications/slug-inexistant-aaaaaaaa',
    });
    expect(unknown.statusCode).toBe(404);
  });
});

describe('Cascade : supprimer une analyse retire sa publication', () => {
  it("dépublie automatiquement à la suppression de l'analyse source", async () => {
    const analysis = await createAnalysis(author);
    const pub = (await publish(author, analysis.id)).json().publication;
    expect(await Publication.findByPk(pub.id)).not.toBeNull();

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/analyses/${analysis.id}`,
      headers: author.headers,
    });
    expect(del.statusCode).toBe(200);
    expect(await Publication.findByPk(pub.id)).toBeNull();
    const pub404 = await app.inject({ method: 'GET', url: `/api/public/publications/${pub.slug}` });
    expect(pub404.statusCode).toBe(404);
  });
});
