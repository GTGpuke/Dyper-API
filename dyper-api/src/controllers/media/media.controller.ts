// Contrôleur de service des miniatures d'analyses (authentification par cookie uniquement —
// une balise <img> ne peut pas envoyer le header X-App-Key).
import fs from 'node:fs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Analysis } from '../../models';
import { resolveThumbnailPath } from '../../services/media/media.service';
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
