// Authentification unifiée des routes protégées : deux modes, deux abonnements.
//
//  - Session web : header X-App-Key (clé applicative first-party) + cookie JWT « dyper_token ».
//    → quotas du forfait du SITE.
//  - Clé API développeur : header « Authorization: Bearer dyk_live_… ».
//    → quotas du forfait de l'API (distinct du site).
//
// `request.authVia` indique le mode retenu ; les contrôleurs s'en servent pour appliquer le bon
// jeu de quotas. `requireSession` restreint une route aux sessions web (gestion de compte, etc.).
import type { FastifyReply, FastifyRequest } from 'fastify';
import { authenticateApiKey } from '../services/api-key/api-key.service';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { verifyAppKey } from './verifyAppKey';
import { verifyAuth } from './verifyAuth';

const BEARER = 'Bearer ';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authz = request.headers.authorization;

  // Mode clé API : « Authorization: Bearer dyk_… » suffit (ni clé applicative, ni cookie requis).
  if (typeof authz === 'string' && authz.startsWith(`${BEARER}dyk_`)) {
    const raw = authz.slice(BEARER.length).trim();
    const result = await authenticateApiKey(raw);
    if (!result) {
      throw new UnauthorizedError('Clé API invalide ou révoquée.');
    }
    request.authUser = { id: result.user.id, email: result.user.email };
    request.authVia = 'apikey';
    request.apiKeyId = result.apiKeyId;
    return;
  }

  // Mode session web : clé applicative + JWT de session.
  await verifyAppKey(request, reply);
  await verifyAuth(request, reply);
  request.authVia = 'session';
}

/** Restreint une route à une session web (refuse l'accès par clé API — ex. gestion de compte). */
export async function requireSession(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (request.authVia !== 'session') {
    throw new ForbiddenError(
      "Cette ressource n'est accessible qu'en session sur le site (pas par clé API)."
    );
  }
}
