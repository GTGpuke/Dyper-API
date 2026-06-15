// Vérifie la présence et la validité de la clé applicative (header X-App-Key) sur les routes /api.
// Lève une AppError 401 (formatée par le gestionnaire d'erreurs global) en cas d'absence ou d'invalidité.
import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../services/env.service';
import { AppError } from '../utils/errors';

// Comparaison à temps constant : neutralise les attaques temporelles sur la clé applicative.
// Les longueurs différentes échouent d'emblée (timingSafeEqual exige des tampons de même taille).
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function verifyAppKey(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const appKey = request.headers['x-app-key'];
  if (typeof appKey !== 'string' || !safeEqual(appKey, env.APP_KEY)) {
    throw new AppError('Clé applicative manquante ou invalide.', 'INVALID_APP_KEY', 401);
  }
}
