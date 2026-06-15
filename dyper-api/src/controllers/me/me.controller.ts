// Contrôleurs du compte courant (/api/me) : profil, mot de passe, préférences, sessions, données.
// Toutes ces routes sont protégées par verifyAuth → request.authUser est garanti présent.

import type { FastifyReply, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { Analysis, ChatExchange, Conversation, Message, User } from '../../models';
import {
  countActiveKeys,
  createApiKey,
  listApiKeys,
  MAX_KEYS_PER_USER,
  revokeApiKey,
} from '../../services/api-key/api-key.service';
import {
  clearCookieOptions,
  cookieOptions,
  hashPassword,
  TOKEN_COOKIE,
  TOKEN_TTL,
  tokenPayload,
  verifyPassword,
} from '../../services/auth/auth.service';
import { capacityStatus } from '../../services/capacity/capacity.service';
import sequelize from '../../services/db/database.service';
import logger from '../../services/logger.service';
import { deleteMediaFiles } from '../../services/media/media.service';
import {
  API_PLAN_IDS,
  API_TOKEN_PACKS,
  addApiTokens,
  apiPlanView,
  apiUsageView,
  normalizeApiPlan,
  normalizePlan,
  PLAN_IDS,
  planView,
  usageView,
} from '../../services/plan/plan.service';
import type { ApiPlanId, PlanId, UserSettings } from '../../types';
import { UnauthorizedError, ValidationError } from '../../utils/errors';

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

// GET /api/me/plan — forfait courant et ses quotas/privilèges.
export async function getPlan(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await currentUser(request);
  reply.send({ success: true, ...planView(user) });
}

// GET /api/me/usage — consommation courante sur la période mensuelle (avec RAZ implicite).
export async function getUsage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await currentUser(request);
  const view = usageView(user);
  // usageView a pu réinitialiser la période en mémoire : on persiste pour figer le nouveau cycle.
  await user.save();
  reply.send({ success: true, ...view });
}

// POST /api/me/checkout — souscription d'un forfait (paiement FACTICE : aucune transaction réelle).
// Les informations de carte éventuelles ne sont ni lues ni stockées ; seule la sélection est
// appliquée. Retourne une référence de facture fictive pour une expérience cohérente côté interface.
export async function checkout(
  request: FastifyRequest<{ Body: { plan: string } }>,
  reply: FastifyReply
): Promise<void> {
  const user = await currentUser(request);
  const plan = request.body?.plan;
  if (!PLAN_IDS.includes(plan as PlanId)) {
    throw new ValidationError('Forfait inconnu.', { allowed: PLAN_IDS });
  }

  const previous = normalizePlan(user.plan);
  user.plan = normalizePlan(plan);
  await user.save();

  logger.info('Forfait mis à jour (paiement factice).', {
    userId: user.id,
    from: previous,
    to: user.plan,
  });

  reply.send({
    success: true,
    ...planView(user),
    // Reçu fictif : confère une apparence de transaction sans facturation réelle.
    receipt: { id: `dyper_demo_${uuidv4()}`, paid: user.plan !== 'free', previousPlan: previous },
  });
}

// GET /api/me/capacity — charge courante de la passerelle (analyses actives et en file).
// Permet à l'interface d'informer l'utilisateur quand le service est très sollicité.
export async function getCapacity(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.send({ success: true, ...capacityStatus() });
}

// ─── API publique : clés et abonnement développeur (distinct du forfait du site) ──────────────────

// GET /api/me/api-plan — forfait API courant et ses quotas.
export async function getApiPlan(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await currentUser(request);
  reply.send({ success: true, ...apiPlanView(user) });
}

// GET /api/me/api-usage — consommation API mensuelle courante.
export async function getApiUsage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await currentUser(request);
  const view = apiUsageView(user);
  await user.save();
  reply.send({ success: true, ...view });
}

// POST /api/me/api-checkout — souscription d'un forfait API (paiement factice).
export async function apiCheckout(
  request: FastifyRequest<{ Body: { plan: string } }>,
  reply: FastifyReply
): Promise<void> {
  const user = await currentUser(request);
  const plan = request.body?.plan;
  if (!API_PLAN_IDS.includes(plan as ApiPlanId)) {
    throw new ValidationError('Forfait API inconnu.', { allowed: API_PLAN_IDS });
  }
  const previous = normalizeApiPlan(user.api_plan);
  user.api_plan = normalizeApiPlan(plan);
  await user.save();
  logger.info('Forfait API mis à jour (paiement factice).', {
    userId: user.id,
    from: previous,
    to: user.api_plan,
  });
  reply.send({
    success: true,
    ...apiPlanView(user),
    receipt: {
      id: `dyper_api_demo_${uuidv4()}`,
      paid: user.api_plan !== 'free',
      previousPlan: previous,
    },
  });
}

// POST /api/me/api-tokens — achat d'un pack de tokens (crédits de dépassement). Paiement factice.
export async function buyApiTokens(
  request: FastifyRequest<{ Body: { pack: string } }>,
  reply: FastifyReply
): Promise<void> {
  const user = await currentUser(request);
  const pack = request.body?.pack ?? '';
  if (!(pack in API_TOKEN_PACKS)) {
    throw new ValidationError('Pack de tokens inconnu.', { allowed: Object.keys(API_TOKEN_PACKS) });
  }
  const balance = await addApiTokens(user.id, pack);
  logger.info('Achat de tokens API (paiement factice).', {
    userId: user.id,
    pack,
    added: API_TOKEN_PACKS[pack],
  });
  reply.send({
    success: true,
    tokenBalance: balance,
    receipt: { id: `dyper_tokens_demo_${uuidv4()}`, pack, tokens: API_TOKEN_PACKS[pack] },
  });
}

// GET /api/me/api-keys — liste des clés API actives (jamais les secrets).
export async function getApiKeys(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await currentUser(request);
  const keys = await listApiKeys(user.id);
  reply.send({ success: true, keys: keys.map((k) => k.toPublic()) });
}

// POST /api/me/api-keys — crée une clé API. Le secret n'est renvoyé QU'ICI (jamais ensuite).
export async function postApiKey(
  request: FastifyRequest<{ Body: { name?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const user = await currentUser(request);
  if ((await countActiveKeys(user.id)) >= MAX_KEYS_PER_USER) {
    throw new ValidationError(`Nombre maximal de clés actives atteint (${MAX_KEYS_PER_USER}).`);
  }
  const created = await createApiKey(user.id, request.body?.name ?? 'Clé API');
  logger.info('Clé API créée.', { userId: user.id, prefix: created.prefix });
  reply.status(201).send({ success: true, key: created });
}

// DELETE /api/me/api-keys/:id — révoque une clé API.
export async function deleteApiKey(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const user = await currentUser(request);
  const revoked = await revokeApiKey(user.id, request.params.id);
  if (!revoked) {
    throw new ValidationError('Clé API introuvable.');
  }
  reply.send({ success: true });
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

  // Chemins des médias (miniatures + vidéos) à supprimer du disque, avant la transaction.
  const mediaPaths = (
    await Analysis.findAll({ attributes: ['thumbnail_path', 'video_path'], where: analysisWhere })
  ).flatMap((a) => [a.thumbnail_path, a.video_path]);

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
  await deleteMediaFiles(mediaPaths);

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

  // Chemins des médias (miniatures + vidéos) à supprimer du disque, avant la transaction.
  const mediaPaths = (
    await Analysis.findAll({
      attributes: ['thumbnail_path', 'video_path'],
      where: { user_id: user.id },
    })
  ).flatMap((a) => [a.thumbnail_path, a.video_path]);

  await sequelize.transaction(async (tx) => {
    await Analysis.destroy({ where: { user_id: user.id }, transaction: tx });
    await ChatExchange.destroy({ where: { user_id: user.id }, transaction: tx });
    await Message.destroy({ where: { user_id: user.id }, transaction: tx });
    await Conversation.destroy({ where: { user_id: user.id }, transaction: tx });
    await user.destroy({ transaction: tx });
  });

  await deleteMediaFiles(mediaPaths);

  logger.info('Compte supprimé.', { userId: user.id });
  reply.clearCookie(TOKEN_COOKIE, clearCookieOptions());
  reply.send({ success: true });
}
