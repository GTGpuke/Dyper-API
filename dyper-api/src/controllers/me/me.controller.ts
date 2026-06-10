// Contrôleurs du compte courant (/api/me) : profil, mot de passe, préférences, sessions, données.
// Toutes ces routes sont protégées par verifyAuth → request.authUser est garanti présent.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Analysis, ChatExchange, Conversation, Message, User } from '../../models';
import {
  clearCookieOptions,
  cookieOptions,
  hashPassword,
  TOKEN_COOKIE,
  TOKEN_TTL,
  tokenPayload,
  verifyPassword,
} from '../../services/auth/auth.service';
import sequelize from '../../services/db/database.service';
import logger from '../../services/logger.service';
import { deleteThumbnails } from '../../services/media/media.service';
import type { UserSettings } from '../../types';
import { UnauthorizedError } from '../../utils/errors';

// Récupère l'utilisateur courant en base ou lève une erreur (compte supprimé entre-temps).
async function currentUser(request: FastifyRequest): Promise<User> {
  const id = request.authUser?.id;
  const user = id ? await User.findByPk(id) : null;
  if (!user) throw new UnauthorizedError();
  return user;
}

// GET /api/me — profil + préférences résolues.
export async function getMe(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await currentUser(request);
  reply.send({ success: true, user: user.toPublic(), settings: user.resolvedSettings() });
}

// PATCH /api/me/profile — met à jour les champs de profil fournis.
export async function updateProfile(
  request: FastifyRequest<{ Body: { displayName?: string; avatarUrl?: string; bio?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const user = await currentUser(request);
  const { displayName, avatarUrl, bio } = request.body;

  if (displayName !== undefined) user.display_name = displayName.trim() || null;
  if (avatarUrl !== undefined) user.avatar_url = avatarUrl.trim() || null;
  if (bio !== undefined) user.bio = bio.trim() || null;

  await user.save();
  reply.send({ success: true, user: user.toPublic() });
}

// PATCH /api/me/password — change le mot de passe après vérification de l'actuel.
export async function changePassword(
  request: FastifyRequest<{ Body: { currentPassword: string; newPassword: string } }>,
  reply: FastifyReply
): Promise<void> {
  const user = await currentUser(request);
  const ok = await verifyPassword(request.body.currentPassword, user.password_hash);
  if (!ok) throw new UnauthorizedError('Mot de passe actuel incorrect.');

  user.password_hash = await hashPassword(request.body.newPassword);
  await user.save();
  reply.send({ success: true });
}

// PUT /api/me/settings — fusionne en profondeur les préférences.
export async function updateSettings(
  request: FastifyRequest<{ Body: Partial<UserSettings> }>,
  reply: FastifyReply
): Promise<void> {
  const user = await currentUser(request);
  const current = user.resolvedSettings();
  const next: UserSettings = {
    appearance: { ...current.appearance, ...request.body.appearance },
    analysis: { ...current.analysis, ...request.body.analysis },
  };
  user.settings = next;
  await user.save();
  reply.send({ success: true, settings: next });
}

// GET /api/me/sessions — session courante (v1 : pas de table de sessions, vue synthétique).
export async function getSessions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await currentUser(request);
  reply.send({
    success: true,
    sessions: [{ current: true, userAgent: request.headers['user-agent'] ?? null, ip: request.ip }],
  });
}

// POST /api/me/sessions/revoke-all — invalide tous les tokens existants puis réémet le cookie courant.
export async function revokeAllSessions(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = await currentUser(request);
  user.token_version += 1;
  await user.save();

  // Réémet une session valide pour l'appareil courant (les autres sont déconnectés).
  const token = await reply.jwtSign(tokenPayload(user), { expiresIn: TOKEN_TTL });
  reply.setCookie(TOKEN_COOKIE, token, cookieOptions());
  reply.send({ success: true });
}

// GET /api/me/export — exporte toutes les données de l'utilisateur (téléchargement JSON).
export async function exportData(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await currentUser(request);
  const [analyses, chats, conversations, messages] = await Promise.all([
    Analysis.findAll({ where: { user_id: user.id }, order: [['created_at', 'DESC']] }),
    ChatExchange.findAll({ where: { user_id: user.id }, order: [['created_at', 'ASC']] }),
    Conversation.findAll({ where: { user_id: user.id }, order: [['created_at', 'ASC']] }),
    Message.findAll({ where: { user_id: user.id }, order: [['created_at', 'ASC']] }),
  ]);

  reply
    .header('Content-Type', 'application/json')
    .header('Content-Disposition', 'attachment; filename="dyper-export.json"')
    .send({
      exportedAt: new Date().toISOString(),
      user: user.toPublic(),
      settings: user.resolvedSettings(),
      analyses,
      chats,
      conversations,
      messages,
    });
}

// DELETE /api/me/history — purge l'historique de l'utilisateur (filtre type optionnel).
export async function purgeHistory(
  request: FastifyRequest<{ Body: { type?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const user = await currentUser(request);
  const analysisWhere: Record<string, unknown> = { user_id: user.id };
  if (request.body?.type) analysisWhere.type = request.body.type;

  // Chemins des miniatures à supprimer du disque, collectés avant la transaction.
  const thumbnails = (
    await Analysis.findAll({ attributes: ['thumbnail_path'], where: analysisWhere })
  ).map((a) => a.thumbnail_path);

  const deleted = await sequelize.transaction(async (tx) => {
    const count = await Analysis.destroy({ where: analysisWhere, transaction: tx });
    // Sans filtre de type, « tout effacer » inclut chats, conversations et messages.
    if (!request.body?.type) {
      await ChatExchange.destroy({ where: { user_id: user.id }, transaction: tx });
      await Message.destroy({ where: { user_id: user.id }, transaction: tx });
      await Conversation.destroy({ where: { user_id: user.id }, transaction: tx });
    }
    return count;
  });

  // Suppression des fichiers hors transaction (le système de fichiers n'est pas transactionnel).
  await deleteThumbnails(thumbnails);

  logger.info('Historique purgé.', { userId: user.id, deleted });
  reply.send({ success: true, deleted });
}

// DELETE /api/me/account — supprime le compte et toutes ses données (re-confirmation par mot de passe).
export async function deleteAccount(
  request: FastifyRequest<{ Body: { password: string } }>,
  reply: FastifyReply
): Promise<void> {
  const user = await currentUser(request);
  const ok = await verifyPassword(request.body.password, user.password_hash);
  if (!ok) throw new UnauthorizedError('Mot de passe incorrect.');

  // Chemins des miniatures à supprimer du disque, collectés avant la transaction.
  const thumbnails = (
    await Analysis.findAll({ attributes: ['thumbnail_path'], where: { user_id: user.id } })
  ).map((a) => a.thumbnail_path);

  await sequelize.transaction(async (tx) => {
    await Analysis.destroy({ where: { user_id: user.id }, transaction: tx });
    await ChatExchange.destroy({ where: { user_id: user.id }, transaction: tx });
    await Message.destroy({ where: { user_id: user.id }, transaction: tx });
    await Conversation.destroy({ where: { user_id: user.id }, transaction: tx });
    await user.destroy({ transaction: tx });
  });

  await deleteThumbnails(thumbnails);

  logger.info('Compte supprimé.', { userId: user.id });
  reply.clearCookie(TOKEN_COOKIE, clearCookieOptions());
  reply.send({ success: true });
}
