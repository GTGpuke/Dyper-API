// Middleware d'authentification utilisateur : vérifie le JWT (cookie httpOnly « dyper_token »),
// contrôle la version du token (révocation globale) et attache l'identité à la requête.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { User } from '../models';
import { UnauthorizedError } from '../utils/errors';

export async function verifyAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  let payload: { sub: string; email: string; tv: number };
  try {
    // jwtVerify lit automatiquement le token depuis le cookie configuré dans app.ts.
    payload = await request.jwtVerify();
  } catch {
    throw new UnauthorizedError();
  }

  // Vérifie que le compte existe encore et que le token n'a pas été révoqué (token_version).
  const user = await User.findByPk(payload.sub);
  if (!user || user.token_version !== payload.tv) {
    throw new UnauthorizedError();
  }

  request.authUser = { id: user.id, email: user.email };
}
