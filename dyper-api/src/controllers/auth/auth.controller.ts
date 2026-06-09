// Contrôleurs d'authentification : inscription, connexion, déconnexion.
// Le JWT est posé dans un cookie httpOnly ; aucune donnée sensible n'est renvoyée au client.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { User } from '../../models';
import {
  clearCookieOptions,
  cookieOptions,
  hashPassword,
  normalizeEmail,
  TOKEN_COOKIE,
  TOKEN_TTL,
  tokenPayload,
  verifyPassword,
} from '../../services/auth/auth.service';
import logger from '../../services/logger.service';
import { ConflictError, UnauthorizedError } from '../../utils/errors';

interface RegisterBody {
  email: string;
  password: string;
  displayName?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

// Pose le cookie de session signé pour l'utilisateur donné.
async function issueSession(reply: FastifyReply, user: User): Promise<void> {
  const token = await reply.jwtSign(tokenPayload(user), { expiresIn: TOKEN_TTL });
  reply.setCookie(TOKEN_COOKIE, token, cookieOptions());
}

// POST /api/auth/register — crée un compte et ouvre une session.
export async function register(
  request: FastifyRequest<{ Body: RegisterBody }>,
  reply: FastifyReply
): Promise<void> {
  const email = normalizeEmail(request.body.email);
  const displayName = request.body.displayName?.trim() || null;

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new ConflictError('Cette adresse e-mail est déjà utilisée.');
  }

  const password_hash = await hashPassword(request.body.password);
  const user = await User.create({ email, password_hash, display_name: displayName });

  logger.info('Nouveau compte créé.', { userId: user.id });
  await issueSession(reply, user);
  reply.status(201).send({ success: true, user: user.toPublic() });
}

// POST /api/auth/login — vérifie les identifiants et ouvre une session.
export async function login(
  request: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply
): Promise<void> {
  const email = normalizeEmail(request.body.email);
  const user = await User.findOne({ where: { email } });

  // Message volontairement générique (anti-énumération de comptes).
  const valid = user ? await verifyPassword(request.body.password, user.password_hash) : false;
  if (!user || !valid) {
    throw new UnauthorizedError('Identifiants invalides.');
  }

  await issueSession(reply, user);
  reply.send({ success: true, user: user.toPublic() });
}

// POST /api/auth/logout — efface le cookie de session (sans exiger de session valide).
export async function logout(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.clearCookie(TOKEN_COOKIE, clearCookieOptions());
  reply.send({ success: true });
}
