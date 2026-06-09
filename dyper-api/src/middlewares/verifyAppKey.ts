// Vérifie la présence et la validité de la clé applicative (header X-App-Key) sur les routes /api.
// Lève une AppError 401 (formatée par le gestionnaire d'erreurs global) en cas d'absence ou d'invalidité.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../services/env.service';
import { AppError } from '../utils/errors';

export async function verifyAppKey(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const appKey = request.headers['x-app-key'];
  if (!appKey || appKey !== env.APP_KEY) {
    throw new AppError('Clé applicative manquante ou invalide.', 'INVALID_APP_KEY', 401);
  }
}
