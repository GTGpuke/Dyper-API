// Service des forfaits d'abonnement : quotas, remise à zéro mensuelle et application côté passerelle.
//
// Principe directeur : TOUS les forfaits offrent exactement la même qualité d'analyse et la même
// puissance de calcul. Seuls diffèrent les VOLUMES mensuels, les TAILLES de fichier autorisées et
// la PRIORITÉ dans la file d'attente (cf. capacity.service, allocation de capacité). Aucun forfait
// ne dégrade le traitement — la facturation est factice (vitrine), mais les quotas sont réels.
import { User } from '../../models';
import type {
  ApiPlanId,
  ApiPlanLimits,
  ApiPlanView,
  ApiUsageView,
  PlanId,
  PlanLimits,
  PlanView,
  ProcessAiResponse,
  UsageView,
} from '../../types';
import {
  FileTooLargeError,
  QuotaExceededError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/errors';

const MB = 1024 * 1024;

// Quotas par forfait. Les tailles de fichier ne dépassent jamais la borne du multipart (app.ts).
const LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    monthlyAnalyses: 40,
    monthlyVideoMinutes: 10,
    maxImageMb: 10,
    maxVideoMb: 30,
    queuePriority: 0,
  },
  pro: {
    monthlyAnalyses: 400,
    monthlyVideoMinutes: 120,
    maxImageMb: 20,
    maxVideoMb: 100,
    queuePriority: 1,
  },
  studio: {
    monthlyAnalyses: -1,
    monthlyVideoMinutes: 600,
    maxImageMb: 20,
    maxVideoMb: 100,
    queuePriority: 2,
  },
};

/** Liste ordonnée des forfaits (vitrine). */
export const PLAN_IDS: readonly PlanId[] = ['free', 'pro', 'studio'];

/** Normalise une valeur arbitraire en forfait connu (repli sur « free »). */
export function normalizePlan(value: unknown): PlanId {
  return value === 'pro' || value === 'studio' ? value : 'free';
}

/** Quotas du forfait donné. */
export function planLimits(plan: PlanId): PlanLimits {
  return LIMITS[plan] ?? LIMITS.free;
}

/** Priorité de file d'attente du forfait (utilisée par l'allocation de capacité). */
export function queuePriority(plan: PlanId): number {
  return planLimits(plan).queuePriority;
}

// Début du mois civil suivant la date donnée (instant de remise à zéro des quotas).
function startOfNextMonth(from: Date): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

// Remet les compteurs à zéro si la période mensuelle est échue (ou jamais initialisée).
// Mutation en mémoire : l'appelant persiste via user.save(). Retourne true si une RAZ a eu lieu.
function rollPeriod(user: User, now: Date): boolean {
  const start = user.usage_period_start;
  if (!start || now >= startOfNextMonth(new Date(start))) {
    user.usage_count = 0;
    user.usage_video_seconds = 0;
    user.usage_period_start = now;
    return true;
  }
  return false;
}

// Charge l'utilisateur ou lève 401 (compte supprimé entre-temps).
async function loadUser(userId: string): Promise<User> {
  const user = await User.findByPk(userId);
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Vérifie qu'une nouvelle analyse respecte les quotas du forfait, AVANT tout traitement.
 * Applique la remise à zéro mensuelle au passage. Lève {@link FileTooLargeError} (taille) ou
 * {@link QuotaExceededError} (volume mensuel) avec, en détails, le forfait courant et la limite —
 * de quoi proposer une montée en gamme ciblée côté interface.
 */
export async function assertWithinQuota(
  userId: string,
  opts: { isVideo: boolean; fileBytes?: number }
): Promise<PlanId> {
  const user = await loadUser(userId);
  const plan = normalizePlan(user.plan);
  const limits = planLimits(plan);

  // Taille de fichier (uploads uniquement ; les analyses par URL n'ont pas de fichier local).
  if (opts.fileBytes !== undefined) {
    const maxMb = opts.isVideo ? limits.maxVideoMb : limits.maxImageMb;
    if (opts.fileBytes > maxMb * MB) {
      throw new FileTooLargeError({ maxMb, plan, kind: opts.isVideo ? 'video' : 'image' });
    }
  }

  if (rollPeriod(user, new Date())) await user.save();

  // Volume mensuel d'analyses.
  if (limits.monthlyAnalyses !== -1 && user.usage_count >= limits.monthlyAnalyses) {
    throw new QuotaExceededError("Vous avez atteint votre quota d'analyses mensuel.", {
      plan,
      limit: limits.monthlyAnalyses,
      used: user.usage_count,
      reason: 'analyses',
    });
  }

  // Volume mensuel de minutes vidéo (vérifié à l'entame d'une nouvelle vidéo).
  if (opts.isVideo && limits.monthlyVideoMinutes !== -1) {
    const usedMinutes = user.usage_video_seconds / 60;
    if (usedMinutes >= limits.monthlyVideoMinutes) {
      throw new QuotaExceededError('Vous avez atteint votre quota de minutes vidéo mensuel.', {
        plan,
        limit: limits.monthlyVideoMinutes,
        used: Math.round(usedMinutes),
        reason: 'videoMinutes',
      });
    }
  }

  return plan;
}

// Durée d'une vidéo (secondes) déduite de la réponse d'inférence : dernier instant connu de la
// chronologie, des frames échantillonnées et de la transcription. 0 si indéterminable.
function videoDurationSeconds(res: ProcessAiResponse): number {
  const last = (arr: Array<{ t?: number; end?: number }> | null | undefined): number =>
    arr && arr.length > 0 ? Math.max(...arr.map((e) => e.t ?? e.end ?? 0)) : 0;
  return Math.ceil(Math.max(last(res.timeline), last(res.frames), last(res.transcriptSegments)));
}

/**
 * Comptabilise une analyse réussie dans les compteurs mensuels (analyse + minutes vidéo).
 * Best-effort : un échec de persistance ne doit jamais invalider une analyse déjà produite.
 */
export async function recordAnalysisUsage(
  userId: string,
  opts: { isVideo: boolean; aiResponse?: ProcessAiResponse }
): Promise<void> {
  const user = await loadUser(userId);
  rollPeriod(user, new Date());
  user.usage_count += 1;
  if (opts.isVideo && opts.aiResponse) {
    user.usage_video_seconds += videoDurationSeconds(opts.aiResponse);
  }
  await user.save();
}

/** Vue du forfait courant (limites incluses) pour l'interface. */
export function planView(user: User): PlanView {
  const plan = normalizePlan(user.plan);
  return { plan, limits: planLimits(plan) };
}

/** Vue de la consommation courante, avec remise à zéro implicite si la période est échue. */
export function usageView(user: User): UsageView {
  const plan = normalizePlan(user.plan);
  rollPeriod(user, new Date());
  const start = user.usage_period_start ? new Date(user.usage_period_start) : null;
  const resetsAt = startOfNextMonth(start ?? new Date());
  return {
    plan,
    limits: planLimits(plan),
    usage: {
      analyses: user.usage_count,
      videoMinutes: Math.round((user.usage_video_seconds / 60) * 10) / 10,
    },
    periodStart: start ? start.toISOString() : null,
    resetsAt: resetsAt.toISOString(),
  };
}

// ─── Forfaits de l'API publique (abonnement développeur, indépendant du forfait du site) ──────────

// Quotas par forfait API. Le forfait « free » (sans abonnement) est volontairement limité.
const API_LIMITS: Record<ApiPlanId, ApiPlanLimits> = {
  free: {
    monthlyRequests: 100,
    maxImageMb: 10,
    maxVideoMb: 30,
    rateLimitPerMin: 10,
    queuePriority: 0,
  },
  starter: {
    monthlyRequests: 5000,
    maxImageMb: 20,
    maxVideoMb: 100,
    rateLimitPerMin: 60,
    queuePriority: 1,
  },
  business: {
    monthlyRequests: 50000,
    maxImageMb: 20,
    maxVideoMb: 100,
    rateLimitPerMin: 300,
    queuePriority: 2,
  },
  unlimited: {
    monthlyRequests: -1,
    maxImageMb: 20,
    maxVideoMb: 100,
    rateLimitPerMin: 1000,
    queuePriority: 3,
  },
};

/** Liste ordonnée des forfaits API (vitrine). */
export const API_PLAN_IDS: readonly ApiPlanId[] = ['free', 'starter', 'business', 'unlimited'];

/** Packs de tokens achetables : crédits de dépassement (au-delà du quota mensuel), sans expiration. */
export const API_TOKEN_PACKS: Record<string, number> = {
  small: 1000,
  medium: 10000,
  large: 50000,
};

/** Normalise une valeur arbitraire en forfait API connu (repli sur « free »). */
export function normalizeApiPlan(value: unknown): ApiPlanId {
  return value === 'starter' || value === 'business' || value === 'unlimited' ? value : 'free';
}

/** Quotas du forfait API donné. */
export function apiPlanLimits(plan: ApiPlanId): ApiPlanLimits {
  return API_LIMITS[plan] ?? API_LIMITS.free;
}

/** Priorité de file d'attente du forfait API (utilisée par l'allocation de capacité). */
export function apiQueuePriority(plan: ApiPlanId): number {
  return apiPlanLimits(plan).queuePriority;
}

// Remet à zéro le compteur de requêtes API si la période mensuelle est échue.
function rollApiPeriod(user: User, now: Date): boolean {
  const start = user.api_usage_period_start;
  if (!start || now >= startOfNextMonth(new Date(start))) {
    user.api_usage_count = 0;
    user.api_usage_period_start = now;
    return true;
  }
  return false;
}

/**
 * Vérifie qu'une requête via clé API respecte le forfait API (taille de fichier + quota mensuel),
 * AVANT tout traitement. Lève {@link FileTooLargeError} ou {@link QuotaExceededError}.
 */
export async function assertApiWithinQuota(
  userId: string,
  opts: { isVideo: boolean; fileBytes?: number }
): Promise<ApiPlanId> {
  const user = await loadUser(userId);
  const plan = normalizeApiPlan(user.api_plan);
  const limits = apiPlanLimits(plan);

  if (opts.fileBytes !== undefined) {
    const maxMb = opts.isVideo ? limits.maxVideoMb : limits.maxImageMb;
    if (opts.fileBytes > maxMb * MB) {
      throw new FileTooLargeError({ maxMb, plan, kind: opts.isVideo ? 'video' : 'image' });
    }
  }

  if (rollApiPeriod(user, new Date())) await user.save();

  // Au-delà du quota mensuel, les tokens achetés prennent le relais (crédits de dépassement).
  // Refus uniquement si le quota mensuel est atteint ET qu'il ne reste aucun token.
  const overMonthly =
    limits.monthlyRequests !== -1 && user.api_usage_count >= limits.monthlyRequests;
  if (overMonthly && user.api_token_balance <= 0) {
    throw new QuotaExceededError('Quota de requêtes API mensuel atteint pour votre forfait API.', {
      plan,
      limit: limits.monthlyRequests,
      used: user.api_usage_count,
      reason: 'apiRequests',
      scope: 'api',
    });
  }

  return plan;
}

/**
 * Comptabilise une requête API réussie (best-effort). Tant que le quota mensuel n'est pas atteint,
 * on incrémente le compteur ; au-delà, on consomme un token acheté.
 */
export async function recordApiUsage(userId: string): Promise<void> {
  const user = await loadUser(userId);
  rollApiPeriod(user, new Date());
  const limits = apiPlanLimits(normalizeApiPlan(user.api_plan));
  const withinMonthly =
    limits.monthlyRequests === -1 || user.api_usage_count < limits.monthlyRequests;
  if (withinMonthly) {
    user.api_usage_count += 1;
  } else if (user.api_token_balance > 0) {
    user.api_token_balance -= 1;
  }
  await user.save();
}

/** Crédite le solde de tokens d'un pack acheté (paiement factice). Retourne le nouveau solde. */
export async function addApiTokens(userId: string, pack: string): Promise<number> {
  const amount = API_TOKEN_PACKS[pack];
  if (!amount) {
    throw new ValidationError('Pack de tokens inconnu.', { allowed: Object.keys(API_TOKEN_PACKS) });
  }
  const user = await loadUser(userId);
  user.api_token_balance += amount;
  await user.save();
  return user.api_token_balance;
}

/** Vue du forfait API courant. */
export function apiPlanView(user: User): ApiPlanView {
  const plan = normalizeApiPlan(user.api_plan);
  return { plan, limits: apiPlanLimits(plan) };
}

/** Vue de la consommation API courante (avec remise à zéro implicite). */
export function apiUsageView(user: User): ApiUsageView {
  const plan = normalizeApiPlan(user.api_plan);
  rollApiPeriod(user, new Date());
  const start = user.api_usage_period_start ? new Date(user.api_usage_period_start) : null;
  const resetsAt = startOfNextMonth(start ?? new Date());
  return {
    plan,
    limits: apiPlanLimits(plan),
    usage: { requests: user.api_usage_count },
    tokenBalance: user.api_token_balance,
    periodStart: start ? start.toISOString() : null,
    resetsAt: resetsAt.toISOString(),
  };
}
