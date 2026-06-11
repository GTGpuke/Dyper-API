// Contrôleur de service des médias d'analyses (authentification par cookie uniquement —
// les balises <img> et <video> ne peuvent pas envoyer le header X-App-Key).
import fs from 'node:fs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Analysis } from '../../models';
import { resolveThumbnailPath, statMediaFile } from '../../services/media/media.service';
import { NotFoundError } from '../../utils/errors';

// Format UUID v4 (les request_id sont générés par uuidv4 — toute autre forme est un 404 uniforme).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/media/:requestId — miniature JPEG d'une analyse appartenant à l'utilisateur.
export async function getThumbnail(
  request: FastifyRequest<{ Params: { requestId: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { requestId } = request.params;
  if (!UUID_RE.test(requestId)) {
    throw new NotFoundError('Média introuvable.');
  }

  // Même 404 que l'analyse soit inexistante, à autrui ou sans miniature (pas de fuite d'existence).
  const analysis = await Analysis.findOne({
    where: { request_id: requestId, user_id: request.authUser?.id },
  });
  if (!analysis?.thumbnail_path) {
    throw new NotFoundError('Média introuvable.');
  }

  const absolute = resolveThumbnailPath(analysis.thumbnail_path);
  if (!absolute) {
    throw new NotFoundError('Média introuvable.');
  }

  // Lecture bufferisée : les miniatures font quelques dizaines de Ko au plus.
  let bytes: Buffer;
  try {
    bytes = await fs.promises.readFile(absolute);
  } catch {
    throw new NotFoundError('Média introuvable.');
  }

  reply
    .header('content-type', 'image/jpeg')
    .header('cache-control', 'private, max-age=86400')
    .send(bytes);
}

// GET /api/media/:requestId/video — vidéo originale d'une analyse, en streaming HTTP Range
// (indispensable au seek du lecteur annoté).
// IMPORTANT : le handler RETOURNE reply après send(flux) — un handler async qui retourne
// undefined après un send de flux fait tronquer le corps par Fastify (réponse vide).
export async function getVideo(
  request: FastifyRequest<{ Params: { requestId: string } }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { requestId } = request.params;
  if (!UUID_RE.test(requestId)) {
    throw new NotFoundError('Média introuvable.');
  }

  // Même 404 que l'analyse soit inexistante, à autrui ou sans vidéo (pas de fuite d'existence).
  const analysis = await Analysis.findOne({
    where: { request_id: requestId, user_id: request.authUser?.id },
  });
  if (!analysis?.video_path) {
    throw new NotFoundError('Média introuvable.');
  }

  const media = await statMediaFile(analysis.video_path);
  if (!media) {
    throw new NotFoundError('Média introuvable.');
  }

  reply.header('accept-ranges', 'bytes').header('cache-control', 'private, max-age=86400');

  // Requête partielle (Range) : 206 + tranche du fichier — le seek du lecteur en dépend.
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

  // Requête complète : flux intégral avec longueur annoncée.
  return reply
    .status(200)
    .header('content-type', 'video/mp4')
    .header('content-length', media.size)
    .send(fs.createReadStream(media.absolute));
}
