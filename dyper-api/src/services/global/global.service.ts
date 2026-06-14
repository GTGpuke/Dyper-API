// Helpers du feed public « Global » : slug public, pseudo d'auteur, snapshot d'affichage,
// agrégation des votes et seuil d'auto-masquage des signalements.
import { randomBytes } from 'node:crypto';
import { Op } from 'sequelize';
import type Analysis from '../../models/Analysis';
import type Publication from '../../models/Publication';
import PublicationVote from '../../models/PublicationVote';
import type User from '../../models/User';
import type { PublicationPayload, PublicVote } from '../../types';

// Nombre de signalements distincts au-delà duquel une publication/commentaire est auto-masqué.
export const REPORT_HIDE_THRESHOLD = 3;

/** Slug public aléatoire et URL-safe (~22 caractères) pour les pages publiques /p/:slug. */
export function generatePublicSlug(): string {
  return randomBytes(16).toString('base64url');
}

/** Pseudo public d'un utilisateur : nom d'affichage, sinon pseudo neutre (jamais l'e-mail). */
export function publicHandle(user: User): string {
  const name = user.display_name?.trim();
  return name && name.length > 0 ? name : `membre-${user.id.slice(0, 6)}`;
}

/** Construit le snapshot d'affichage figé d'une analyse (exclut le chat de suivi). */
export function buildPayload(a: Analysis): PublicationPayload {
  return {
    description: a.description,
    model: a.model,
    lang: a.lang,
    sceneLabel: a.scene_label,
    sceneConfidence: a.scene_confidence,
    indoor: a.indoor,
    objectsCount: a.objects_count,
    tags: a.tags,
    colors: a.colors,
    sourceWidth: a.source_width,
    sourceHeight: a.source_height,
    timeline: a.timeline,
    objects: a.objects,
    frameDetections: a.frame_detections,
    music: a.music,
    transcriptSegments: a.transcript_segments,
    audioTranscript: a.audio_transcript,
  };
}

/** Map des votes d'un utilisateur pour un ensemble de publications (pour `myVote`). */
export async function votesByUser(
  userId: string,
  publicationIds: string[]
): Promise<Map<string, PublicVote>> {
  const map = new Map<string, PublicVote>();
  if (publicationIds.length === 0) return map;
  const votes = await PublicationVote.findAll({
    where: { user_id: userId, publication_id: { [Op.in]: publicationIds } },
  });
  for (const vote of votes) {
    map.set(vote.publication_id, vote.value as PublicVote);
  }
  return map;
}

/** Recalcule et persiste les compteurs de votes (up / down / score) d'une publication. */
export async function recountVotes(publication: Publication): Promise<void> {
  const upvotes = await PublicationVote.count({
    where: { publication_id: publication.id, value: 1 },
  });
  const downvotes = await PublicationVote.count({
    where: { publication_id: publication.id, value: -1 },
  });
  publication.upvotes = upvotes;
  publication.downvotes = downvotes;
  publication.score = upvotes - downvotes;
  await publication.save();
}
