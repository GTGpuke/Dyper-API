// Augmentations de types pour Fastify : identité de l'utilisateur authentifié et payload JWT.
import '@fastify/jwt';
import type { AuthUser } from './index';

declare module 'fastify' {
  interface FastifyRequest {
    // Renseigné par le middleware verifyAuth après vérification du JWT.
    authUser?: AuthUser;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    // Charge utile signée dans le token (sub = id utilisateur, tv = token_version).
    payload: { sub: string; email: string; tv: number };
    user: { sub: string; email: string; tv: number };
  }
}
