// Types de domaine partagés de la passerelle Dyper.
// Le contrat de réponse reproduit fidèlement celui documenté dans docs/docs.md (§3).

/** Boîte englobante d'un objet détecté, en pixels. */
export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Objet détecté par le modèle (label COCO brut en anglais). */
export interface DetectedObject {
  label: string;
  confidence: number;
  boundingBox?: BoundingBox;
  /** Identifiant de piste stable entre frames (vidéos trackées). */
  trackId?: number | null;
  /** Détection prioritaire (confiance ≥ seuil) ; les non prioritaires sont décochées par défaut. */
  priority?: boolean;
}

/** Scène inférée à partir des objets détectés. */
export interface Scene {
  label: string;
  confidence: number;
  indoor?: boolean | null;
}

/** Bloc de visualisation structurée retourné par dyper-ai. */
export interface Visualization {
  objects: DetectedObject[];
  scene: Scene;
  colors: string[];
  text: string[];
  tags: string[];
}

/** Présence d'objets à un instant donné d'une vidéo (chronologie d'apparition). */
export interface TimelineEntry {
  t: number;
  labels: string[];
}

/** Détections complètes d'une frame échantillonnée (lecteur vidéo annoté). */
export interface FrameDetections {
  t: number;
  objects: DetectedObject[];
}

/** Bande-son identifiée par fingerprinting (reconnaissance musicale). */
export interface MusicInfo {
  artist: string;
  title: string;
  album?: string | null;
  /** Lien d'écoute (page multi-plateformes AudD), si disponible. */
  link?: string | null;
}

/** Tranche horodatée de la transcription audio. */
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/** Réponse brute du service d'inférence dyper-ai (POST /process). */
export interface ProcessAiResponse {
  requestId: string;
  description: string;
  visualization: Visualization;
  model: string;
  processingTimeMs: number;
  // Champs optionnels (contrat rétrocompatible) pour l'expérience conversationnelle.
  thumbnailBase64?: string | null;
  timeline?: TimelineEntry[] | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  audioTranscript?: string | null;
  frames?: FrameDetections[] | null;
  music?: MusicInfo[] | null;
  transcriptSegments?: TranscriptSegment[] | null;
  /** Vidéo téléchargée depuis une URL de plateforme (base64) — à stocker côté passerelle. */
  videoBase64?: string | null;
}

/** Résultat exposé au client (réponse dyper-ai enrichie de la langue). */
export type AnalysisResult = ProcessAiResponse & { lang: string };

/** Type d'analyse demandé au service d'inférence. */
export type AnalyzeType = 'image' | 'video' | 'prompt';

/** Options transmises au service ai.service pour appeler dyper-ai. */
export interface ProcessOptions {
  requestId: string;
  fileBuffer?: Buffer;
  mimetype?: string;
  imageUrl?: string;
  /** URL d'une vidéo de plateforme (YouTube / Twitch) — analyse vidéo par téléchargement. */
  videoUrl?: string;
  prompt?: string | null;
  lang?: string;
  /** Mode temps réel : détection seule côté dyper-ai (YOLO COCO), sans vision LLM ni vocabulaire ouvert. */
  fast?: boolean;
  /** Signal d'annulation : interrompt l'appel à dyper-ai si le client se déconnecte. */
  signal?: AbortSignal;
}

/** Contexte d'analyse fourni à /api/chat pour répondre à une question de suivi. */
export interface ChatContext {
  description: string;
  visualization: Visualization;
  model: string;
  lang?: string;
  requestId?: string;
  /** Chronologie d'apparition des objets (vidéos) — enrichit le prompt système. */
  timeline?: TimelineEntry[] | null;
  /** Transcription audio (vidéos) — enrichit le prompt système. */
  audioTranscript?: string | null;
  /** Bandes-son identifiées (vidéos) — enrichit le prompt système. */
  music?: MusicInfo[] | null;
  /** Détections par frame (vidéos) : positions des objets dans le temps (résumé par piste). */
  frameDetections?: FrameDetections[] | null;
  /** Transcription horodatée (vidéos) : situe les propos dans le temps. */
  transcriptSegments?: TranscriptSegment[] | null;
  /** Dimensions de la source : rendent les positions interprétables (zones relatives). */
  sourceWidth?: number | null;
  sourceHeight?: number | null;
}

// ─── Préférences utilisateur (colonne JSON `settings` du modèle User) ──────────

/** Apparence de l'interface. */
export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  density: 'comfortable' | 'compact';
}

/** Préférences appliquées aux nouvelles analyses. */
export interface AnalysisSettings {
  defaultLang: string;
  defaultType: 'file' | 'url' | 'prompt';
}

/** Forme complète des préférences utilisateur. */
export interface UserSettings {
  appearance: AppearanceSettings;
  analysis: AnalysisSettings;
}

/** Valeurs par défaut appliquées à la création et à la lecture (forward-compatible). */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  appearance: { theme: 'system', density: 'comfortable' },
  analysis: { defaultLang: 'fr', defaultType: 'file' },
};

/** Identité de l'utilisateur authentifié, attachée à la requête par verifyAuth. */
export interface AuthUser {
  id: string;
  email: string;
}

// ─── Abonnements (forfaits factices, quotas appliqués côté passerelle) ─────────

/** Identifiant de forfait d'abonnement. */
export type PlanId = 'free' | 'pro' | 'studio';

/**
 * Quotas et privilèges d'un forfait. Tous les forfaits offrent la MÊME qualité d'analyse et la
 * même puissance de calcul : seuls diffèrent les volumes mensuels, les tailles de fichier et la
 * priorité dans la file d'attente (allocation de capacité, cf. capacity.service).
 */
export interface PlanLimits {
  /** Analyses par mois (-1 = illimité). */
  monthlyAnalyses: number;
  /** Minutes de vidéo analysées par mois (-1 = illimité). */
  monthlyVideoMinutes: number;
  /** Taille maximale d'une image (Mo). */
  maxImageMb: number;
  /** Taille maximale d'une vidéo (Mo). */
  maxVideoMb: number;
  /** Priorité dans la file d'attente (plus élevé = servi avant). */
  queuePriority: number;
}

/** Vue du forfait courant exposée au client. */
export interface PlanView {
  plan: PlanId;
  limits: PlanLimits;
}

/** Consommation courante d'un utilisateur sur la période mensuelle. */
export interface UsageView {
  plan: PlanId;
  limits: PlanLimits;
  usage: {
    analyses: number;
    videoMinutes: number;
  };
  /** Début de la période de quota (ISO) — null si aucune analyse encore. */
  periodStart: string | null;
  /** Date de remise à zéro des quotas (ISO). */
  resetsAt: string;
}

// ─── API publique : clés et abonnement développeur (distinct du forfait du site) ──

/** Forfait de l'API publique (indépendant du forfait du site web). */
export type ApiPlanId = 'free' | 'starter' | 'business' | 'unlimited';

/** Quotas d'un forfait API. La qualité d'analyse est identique : seuls diffèrent les volumes,
 * tailles de fichier, débit et priorité de file. */
export interface ApiPlanLimits {
  /** Requêtes d'analyse par mois (-1 = illimité). */
  monthlyRequests: number;
  maxImageMb: number;
  maxVideoMb: number;
  /** Débit indicatif (requêtes/minute) annoncé dans la documentation. */
  rateLimitPerMin: number;
  /** Priorité dans la file de calcul (plus élevé = servi avant). */
  queuePriority: number;
}

/** Forfait API courant et ses quotas. */
export interface ApiPlanView {
  plan: ApiPlanId;
  limits: ApiPlanLimits;
}

/** Consommation API courante (période mensuelle). */
export interface ApiUsageView {
  plan: ApiPlanId;
  limits: ApiPlanLimits;
  usage: { requests: number };
  /** Solde de tokens achetés (crédits de dépassement, ne expirent pas). */
  tokenBalance: number;
  periodStart: string | null;
  resetsAt: string;
}

/** Pack de tokens API achetable (crédits de dépassement au-delà du quota mensuel). */
export interface ApiTokenPack {
  id: string;
  tokens: number;
}

/** Vue publique d'une clé API (jamais le secret en clair). */
export interface ApiKeyView {
  id: string;
  name: string;
  /** Préfixe affichable pour identifier la clé (ex. « dyk_live_a1b2c3… »). */
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

/** Réponse de création d'une clé : la vue + le secret en clair, montré UNE SEULE fois. */
export interface ApiKeyCreated extends ApiKeyView {
  secret: string;
}

// ─── Conversations ─────────────────────────────────────────────────────────────

/** Rôle d'un message de conversation. */
export type MessageRole = 'user' | 'assistant';

/** Nature d'un message : texte libre ou carte d'analyse. */
export type MessageKind = 'text' | 'analysis';

/**
 * Cycle de vie d'une carte d'analyse (les messages texte sont toujours « ready ») :
 * `queued` (en file d'attente de calcul) → `pending` (traitement en cours) → `ready` / `error`.
 */
export type MessageStatus = 'queued' | 'pending' | 'ready' | 'error';

/** Analyse inlinée dans un message assistant (vue construite pour le client). */
export interface InlineAnalysis {
  id: string;
  requestId: string;
  type: AnalyzeType;
  description: string;
  model: string;
  lang: string;
  sceneLabel: string;
  sceneConfidence: number;
  indoor: boolean | null;
  objects: DetectedObject[];
  colors: string[];
  tags: string[];
  timeline: TimelineEntry[] | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  thumbnailUrl: string | null;
  audioTranscript: string | null;
  videoUrl: string | null;
  frames: FrameDetections[] | null;
  music: MusicInfo[] | null;
  transcriptSegments: TranscriptSegment[] | null;
}

/** Vue d'un message renvoyée au client (analyse inlinée si carte). */
export interface MessageView {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  attachmentName: string | null;
  /** Statut du message : « pending » pour une analyse en cours (tâche de fond). */
  status: MessageStatus;
  seq: number;
  createdAt: Date;
  analysis: InlineAnalysis | null;
}

// ─── Feed public « Global » ──────────────────────────────────────────────────

/** Vote d'un utilisateur sur une publication : +1, -1 ou 0 (aucun). */
export type PublicVote = -1 | 0 | 1;

/** Snapshot figé des champs d'affichage d'une analyse publiée (indépendant du chat de suivi). */
export interface PublicationPayload {
  description: string;
  model: string;
  lang: string;
  sceneLabel: string;
  sceneConfidence: number;
  indoor: boolean | null;
  objectsCount: number;
  tags: string[];
  colors: string[];
  sourceWidth: number | null;
  sourceHeight: number | null;
  timeline: TimelineEntry[] | null;
  objects: DetectedObject[] | null;
  frameDetections: FrameDetections[] | null;
  music: MusicInfo[] | null;
  transcriptSegments: TranscriptSegment[] | null;
  audioTranscript: string | null;
}

/** Verdict de modération renvoyé par dyper-ai (POST /moderate). */
export interface ModerationResult {
  available: boolean;
  rating: string | null;
}
