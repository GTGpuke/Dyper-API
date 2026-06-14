// Contrôleurs publics (sans connexion) du feed « Global » : page partageable et médias publics.
// Le contenu publié est garanti tout public (modération « tout sensible bloqué ») ; l'accès est
// protégé par un slug aléatoire non devinable. Aucune donnée privée n'est exposée.
import fs from 'node:fs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Publication, PublicationComment } from '../../models';
import { resolveThumbnailPath, statMediaFile } from '../../services/media/media.service';
import { NotFoundError } from '../../utils/errors';

// Slug public attendu (base64url, ~22 caractères) — toute autre forme renvoie un 404 uniforme.
const SLUG_RE = /^[A-Za-z0-9_-]{16,64}$/;

// GET /api/public/publications/:slug — publication publique en lecture seule + commentaires visibles.
export async function getPublicPublication(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { slug } = request.params;
  if (!SLUG_RE.test(slug)) {
    throw new NotFoundError('Publication introuvable.');
  }
  const publication = await Publication.findOne({ where: { public_slug: slug, hidden: false } });
  if (!publication) {
    throw new NotFoundError('Publication introuvable.');
  }
  const comments = await PublicationComment.findAll({
    where: { publication_id: publication.id, hidden: false },
    order: [['created_at', 'ASC']],
  });
  reply.send({
    success: true,
    publication: publication.toPublic(0),
    comments: comments.map((c) => c.toPublic()),
  });
}

// GET /api/public/media/:slug — miniature JPEG publique d'une publication.
export async function getPublicThumbnail(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { slug } = request.params;
  if (!SLUG_RE.test(slug)) {
    throw new NotFoundError('Média introuvable.');
  }
  const publication = await Publication.findOne({ where: { public_slug: slug, hidden: false } });
  if (!publication?.has_thumbnail) {
    throw new NotFoundError('Média introuvable.');
  }
  // Les fichiers médias sont nommés d'après le request_id (cf. media.service).
  const absolute = resolveThumbnailPath(`${publication.request_id}.jpg`);
  if (!absolute) {
    throw new NotFoundError('Média introuvable.');
  }
  let bytes: Buffer;
  try {
    bytes = await fs.promises.readFile(absolute);
  } catch {
    throw new NotFoundError('Média introuvable.');
  }
  reply
    .header('content-type', 'image/jpeg')
    .header('cache-control', 'public, max-age=86400')
    .send(bytes);
}

// GET /api/public/media/:slug/video — vidéo publique en streaming HTTP Range (seek du lecteur).
export async function getPublicVideo(
  request: FastifyRequest<{ Params: { slug: string } }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { slug } = request.params;
  if (!SLUG_RE.test(slug)) {
    throw new NotFoundError('Média introuvable.');
  }
  const publication = await Publication.findOne({ where: { public_slug: slug, hidden: false } });
  if (!publication?.has_video) {
    throw new NotFoundError('Média introuvable.');
  }
  const media = await statMediaFile(`${publication.request_id}.mp4`);
  if (!media) {
    throw new NotFoundError('Média introuvable.');
  }

  reply.header('accept-ranges', 'bytes').header('cache-control', 'public, max-age=86400');

  const range = request.headers.range;
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (match && (match[1] !== '' || match[2] !== '')) {
    const start = match[1] === '' ? Math.max(0, media.size - Number(match[2])) : Number(match[1]);
    const end =
      match[1] !== '' && match[2] !== ''
        ? Math.min(Number(match[2]), media.size - 1)
        : media.size - 1;
    if (start >= media.size || start > end) {
      return reply.status(416).header('content-range', `bytes */${media.size}`).send();
    }
    return reply
      .status(206)
      .header('content-type', 'video/mp4')
      .header('content-range', `bytes ${start}-${end}/${media.size}`)
      .header('content-length', end - start + 1)
      .send(fs.createReadStream(media.absolute, { start, end }));
  }

  return reply
    .status(200)
    .header('content-type', 'video/mp4')
    .header('content-length', media.size)
    .send(fs.createReadStream(media.absolute));
}
