// Augmentations de types pour Fastify : identité de l'utilisateur authentifié et payload JWT.
import '@fastify/jwt';
import type { AuthUser } from './index';

declare module 'fastify' {
  interface FastifyRequest {
    // Renseigné par l'authentification après vérification du JWT ou de la clé API.
    authUser?: AuthUser;
    // Mode d'authentification de la requête : session web (cookie) ou clé API (développeur).
    authVia?: 'session' | 'apikey';
    // Identifiant de la clé API utilisée (si authVia === 'apikey').
    apiKeyId?: string;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    // Charge utile signée dans le token (sub = id utilisateur, tv = token_version).
    payload: { sub: string; email: string; tv: number };
    user: { sub: string; email: string; tv: number };
  }
}
