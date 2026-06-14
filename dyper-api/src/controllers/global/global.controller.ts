// Contrôleurs du feed public « Global » : publier une analyse, voter, commenter, signaler.
// Toutes les routes sont cloisonnées par utilisateur ; la modération est appliquée à la publication
// (image) et aux commentaires (texte) via dyper-ai (politique : tout ce qui n'est pas « safe » est bloqué).
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Op, type Order } from 'sequelize';
import {
  Analysis,
  Publication,
  PublicationComment,
  PublicationReport,
  PublicationVote,
  User,
} from '../../models';
import aiService from '../../services/ai/ai.service';
import sequelize from '../../services/db/database.service';
import {
  buildPayload,
  generatePublicSlug,
  publicHandle,
  REPORT_HIDE_THRESHOLD,
  recountVotes,
  votesByUser,
} from '../../services/global/global.service';
import { readThumbnailBase64 } from '../../services/media/media.service';
import type { PublicVote } from '../../types';
import {
  CommentRejectedError,
  ModerationUnavailableError,
  NotFoundError,
  NsfwContentBlockedError,
  ValidationError,
} from '../../utils/errors';

const CAPTION_MAX = 500;
const COMMENT_MAX = 2000;
const REASON_MAX = 200;
const FEED_LIMIT = 20;

// POST /api/global/publish — publie une analyse de l'utilisateur (après modération du média).
export async function publishAnalysis(
  request: FastifyRequest<{ Body: { analysisId?: string; caption?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  const analysisId = request.body?.analysisId;
  if (!analysisId) {
    throw new ValidationError("L'identifiant de l'analyse est requis.");
  }
  const caption = request.body?.caption?.trim() || null;
  if (caption && caption.length > CAPTION_MAX) {
    throw new ValidationError(`La légende ne peut pas dépasser ${CAPTION_MAX} caractères.`);
  }

  const analysis = await Analysis.findOne({ where: { id: analysisId, user_id: userId } });
  if (!analysis) {
    throw new NotFoundError('Analyse introuvable.');
  }
  // Le feed public présente des analyses visuelles : une miniature est requise.
  if (analysis.type === 'prompt' || !analysis.thumbnail_path) {
    throw new ValidationError(
      "Seules les analyses d'image ou de vidéo (avec aperçu) peuvent être publiées."
    );
  }

  // Modération du média (miniature) — politique : tout ce qui n'est pas « safe » est bloqué.
  const thumbBase64 = await readThumbnailBase64(analysis.thumbnail_path);
  if (!thumbBase64) {
    throw new ValidationError("L'aperçu de l'analyse est introuvable.");
  }
  const verdict = await aiService.moderateImage(thumbBase64, analysis.lang);
  if (!verdict.available) {
    throw new ModerationUnavailableError();
  }
  if (verdict.rating !== 'safe') {
    throw new NsfwContentBlockedError({ rating: verdict.rating });
  }

  // Re-publication idempotente : une seule publication par analyse (met à jour la légende).
  const existing = await Publication.findOne({ where: { analysis_id: analysis.id } });
  if (existing) {
    existing.caption = caption;
    await existing.save();
    reply.status(200).send({ success: true, publication: existing.toPublic(0) });
    return;
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('Utilisateur introuvable.');
  }

  const publication = await Publication.create({
    public_slug: generatePublicSlug(),
    request_id: analysis.request_id,
    analysis_id: analysis.id,
    user_id: userId,
    author_name: publicHandle(user),
    author_avatar: user.avatar_url,
    caption,
    type: analysis.type,
    payload: buildPayload(analysis),
    has_thumbnail: true,
    has_video: Boolean(analysis.video_path),
    moderation_rating: 'safe',
  });

  reply.status(201).send({ success: true, publication: publication.toPublic(0) });
}

// GET /api/global — feed paginé (tri populaire / récent / top).
export async function listFeed(
  request: FastifyRequest<{ Querystring: { sort?: string; page?: number } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  const page = Number(request.query.page ?? 1);
  const offset = (page - 1) * FEED_LIMIT;
  const sort = request.query.sort ?? 'hot';

  // « hot » : score pénalisé par l'ancienneté (julianday est natif SQLite, pas de pow requis).
  let order: Order;
  if (sort === 'new') {
    order = [['created_at', 'DESC']];
  } else if (sort === 'top') {
    order = [
      ['score', 'DESC'],
      ['created_at', 'DESC'],
    ];
  } else {
    order = [
      [sequelize.literal("score - (julianday('now') - julianday(created_at))"), 'DESC'],
      ['created_at', 'DESC'],
    ];
  }

  const { count, rows } = await Publication.findAndCountAll({
    where: { hidden: false },
    order,
    limit: FEED_LIMIT,
    offset,
  });

  const voteMap = await votesByUser(
    userId,
    rows.map((r) => r.id)
  );
  reply.send({
    success: true,
    data: rows.map((r) => ({
      ...r.toPublic(voteMap.get(r.id) ?? 0),
      isMine: r.user_id === userId,
    })),
    total: count,
    page,
    limit: FEED_LIMIT,
  });
}

// GET /api/global/publications/:id — détail d'une publication (avec le vote de l'utilisateur).
export async function getPublication(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  const publication = await Publication.findOne({
    where: { id: request.params.id, hidden: false },
  });
  if (!publication) {
    throw new NotFoundError('Publication introuvable.');
  }
  const vote = await PublicationVote.findOne({
    where: { publication_id: publication.id, user_id: userId },
  });
  reply.send({
    success: true,
    publication: {
      ...publication.toPublic((vote?.value as PublicVote) ?? 0),
      isMine: publication.user_id === userId,
    },
  });
}

// POST /api/global/publications/:id/vote — vote +1 / -1 / 0 (retrait).
export async function votePublication(
  request: FastifyRequest<{ Params: { id: string }; Body: { value?: number } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  const value = request.body?.value;
  if (value !== 1 && value !== -1 && value !== 0) {
    throw new ValidationError('La valeur du vote doit être 1, -1 ou 0.');
  }

  const publication = await Publication.findOne({
    where: { id: request.params.id, hidden: false },
  });
  if (!publication) {
    throw new NotFoundError('Publication introuvable.');
  }

  const existing = await PublicationVote.findOne({
    where: { publication_id: publication.id, user_id: userId },
  });
  if (value === 0) {
    if (existing) await existing.destroy();
  } else if (existing) {
    existing.value = value;
    await existing.save();
  } else {
    await PublicationVote.create({ publication_id: publication.id, user_id: userId, value });
  }

  await recountVotes(publication);
  reply.send({
    success: true,
    score: publication.score,
    upvotes: publication.upvotes,
    downvotes: publication.downvotes,
    myVote: value,
  });
}

// GET /api/global/publications/:id/comments — fil des commentaires visibles (arbre côté client).
export async function listComments(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const publication = await Publication.findOne({
    where: { id: request.params.id, hidden: false },
  });
  if (!publication) {
    throw new NotFoundError('Publication introuvable.');
  }
  const userId = request.authUser?.id as string;
  const comments = await PublicationComment.findAll({
    where: { publication_id: publication.id, hidden: false },
    order: [['created_at', 'ASC']],
  });
  reply.send({
    success: true,
    data: comments.map((c) => ({ ...c.toPublic(), isMine: c.user_id === userId })),
    total: comments.length,
  });
}

// POST /api/global/publications/:id/comments — ajoute un commentaire (après modération du texte).
export async function postComment(
  request: FastifyRequest<{ Params: { id: string }; Body: { body?: string; parentId?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  const body = request.body?.body?.trim();
  if (!body) {
    throw new ValidationError('Le commentaire ne peut pas être vide.');
  }
  if (body.length > COMMENT_MAX) {
    throw new ValidationError(`Le commentaire ne peut pas dépasser ${COMMENT_MAX} caractères.`);
  }

  const publication = await Publication.findOne({
    where: { id: request.params.id, hidden: false },
  });
  if (!publication) {
    throw new NotFoundError('Publication introuvable.');
  }

  const parentId = request.body?.parentId ?? null;
  if (parentId) {
    const parent = await PublicationComment.findOne({
      where: { id: parentId, publication_id: publication.id },
    });
    if (!parent) {
      throw new ValidationError('Le commentaire parent est introuvable.');
    }
  }

  // Modération du texte — politique : tout ce qui n'est pas « safe » est rejeté.
  const verdict = await aiService.moderateText(body, publication.payload.lang);
  if (!verdict.available) {
    throw new ModerationUnavailableError();
  }
  if (verdict.rating !== 'safe') {
    throw new CommentRejectedError({ rating: verdict.rating });
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('Utilisateur introuvable.');
  }

  const comment = await PublicationComment.create({
    publication_id: publication.id,
    user_id: userId,
    parent_id: parentId,
    author_name: publicHandle(user),
    author_avatar: user.avatar_url,
    body,
  });
  publication.comment_count += 1;
  await publication.save();

  reply.status(201).send({ success: true, comment: comment.toPublic() });
}

// DELETE /api/global/comments/:id — supprime son propre commentaire.
export async function deleteComment(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  const comment = await PublicationComment.findOne({
    where: { id: request.params.id, user_id: userId },
  });
  if (!comment) {
    throw new NotFoundError('Commentaire introuvable.');
  }
  const publicationId = comment.publication_id;
  await comment.destroy();
  // Décrémente le compteur dénormalisé (sans descendre sous zéro).
  const publication = await Publication.findByPk(publicationId);
  if (publication && publication.comment_count > 0) {
    publication.comment_count -= 1;
    await publication.save();
  }
  reply.send({ success: true });
}

// DELETE /api/global/publications/:id — dépublie sa propre publication (cascade votes/commentaires/signalements).
export async function deletePublication(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  const publication = await Publication.findOne({
    where: { id: request.params.id, user_id: userId },
  });
  if (!publication) {
    throw new NotFoundError('Publication introuvable.');
  }

  // Identifiants des commentaires (pour purger aussi leurs signalements).
  const commentIds = (
    await PublicationComment.findAll({
      attributes: ['id'],
      where: { publication_id: publication.id },
    })
  ).map((c) => c.id);

  // Dépublier ne supprime PAS l'analyse privée ni ses médias (ils restent dans l'historique).
  await sequelize.transaction(async (tx) => {
    await PublicationVote.destroy({ where: { publication_id: publication.id }, transaction: tx });
    await PublicationComment.destroy({
      where: { publication_id: publication.id },
      transaction: tx,
    });
    await PublicationReport.destroy({
      where: { target_id: { [Op.in]: [publication.id, ...commentIds] } },
      transaction: tx,
    });
    await publication.destroy({ transaction: tx });
  });

  reply.send({ success: true });
}

// Enregistre un signalement (idempotent par utilisateur) et auto-masque la cible au seuil.
async function registerReport(
  targetType: 'publication' | 'comment',
  targetId: string,
  userId: string,
  reason: string
): Promise<void> {
  await PublicationReport.findOrCreate({
    where: { target_type: targetType, target_id: targetId, user_id: userId },
    defaults: { target_type: targetType, target_id: targetId, user_id: userId, reason },
  });
  const count = await PublicationReport.count({
    where: { target_type: targetType, target_id: targetId },
  });
  if (count < REPORT_HIDE_THRESHOLD) return;

  if (targetType === 'publication') {
    await Publication.update({ hidden: true }, { where: { id: targetId } });
  } else {
    await PublicationComment.update({ hidden: true }, { where: { id: targetId } });
  }
}

function reportReason(raw: string | undefined): string {
  const reason = (raw ?? '').trim().slice(0, REASON_MAX);
  return reason || 'non précisé';
}

// POST /api/global/publications/:id/report — signale une publication.
export async function reportPublication(
  request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  const publication = await Publication.findOne({
    where: { id: request.params.id, hidden: false },
  });
  if (!publication) {
    throw new NotFoundError('Publication introuvable.');
  }
  await registerReport('publication', publication.id, userId, reportReason(request.body?.reason));
  reply.send({ success: true });
}

// POST /api/global/comments/:id/report — signale un commentaire.
export async function reportComment(
  request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.authUser?.id as string;
  const comment = await PublicationComment.findOne({
    where: { id: request.params.id, hidden: false },
  });
  if (!comment) {
    throw new NotFoundError('Commentaire introuvable.');
  }
  await registerReport('comment', comment.id, userId, reportReason(request.body?.reason));
  reply.send({ success: true });
}
