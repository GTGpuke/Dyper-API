// Service des clés d'API : génération, hachage, authentification, listing et révocation.
//
// Sécurité : le secret complet (« dyk_live_… ») n'est montré qu'à la création. On ne stocke que
// son empreinte SHA-256 ; une clé perdue n'est donc pas récupérable (il faut en créer une autre).
import { createHash, randomBytes } from 'node:crypto';
import { ApiKey, User } from '../../models';
import type { ApiKeyCreated } from '../../types';

const KEY_PREFIX = 'dyk_live_';
// Longueur du préfixe affichable conservé en clair (assez pour identifier la clé sans la révéler).
const DISPLAY_PREFIX_LENGTH = KEY_PREFIX.length + 8;
// Plafond de clés actives par compte (garde-fou).
export const MAX_KEYS_PER_USER = 10;

// Empreinte SHA-256 (hex) d'une clé complète.
function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Crée une clé pour l'utilisateur et retourne le secret EN CLAIR (à montrer une seule fois).
 * Le secret n'est jamais persisté : seules son empreinte et un préfixe d'affichage le sont.
 */
export async function createApiKey(userId: string, name: string): Promise<ApiKeyCreated> {
  const secret = `${KEY_PREFIX}${randomBytes(24).toString('hex')}`;
  const record = await ApiKey.create({
    user_id: userId,
    name: name.trim() || 'Clé API',
    key_prefix: secret.slice(0, DISPLAY_PREFIX_LENGTH),
    key_hash: hashKey(secret),
  });
  return { ...record.toPublic(), secret };
}

/** Liste les clés actives (non révoquées) d'un utilisateur, des plus récentes aux plus anciennes. */
export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  return ApiKey.findAll({
    where: { user_id: userId, revoked_at: null },
    order: [['created_at', 'DESC']],
  });
}

/** Nombre de clés actives d'un utilisateur. */
export async function countActiveKeys(userId: string): Promise<number> {
  return ApiKey.count({ where: { user_id: userId, revoked_at: null } });
}

/** Révoque une clé appartenant à l'utilisateur. Retourne false si introuvable (anti-IDOR). */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const key = await ApiKey.findOne({ where: { id: keyId, user_id: userId, revoked_at: null } });
  if (!key) return false;
  key.revoked_at = new Date();
  await key.save();
  return true;
}

/**
 * Authentifie une clé brute présentée par un client API. Retourne l'utilisateur propriétaire et
 * l'identifiant de clé, ou null si la clé est inconnue ou révoquée. Met à jour `last_used_at`.
 */
export async function authenticateApiKey(
  raw: string
): Promise<{ user: User; apiKeyId: string } | null> {
  const key = await ApiKey.findOne({ where: { key_hash: hashKey(raw), revoked_at: null } });
  if (!key) return null;

  const user = await User.findByPk(key.user_id);
  if (!user) return null;

  // Suivi d'utilisation (best-effort : ne bloque jamais la requête).
  key.last_used_at = new Date();
  await key.save().catch(() => undefined);

  return { user, apiKeyId: key.id };
}
