// Définition de tous les types partagés de l'application Dyper Web.

// ─── Visualisation & résultat d'analyse (réponse live de /api/analyze*) ──────

export interface BoundingBox {
  x: number
  y: number
  w: number
  h: number
}

export interface DetectedObject {
  label: string
  confidence: number
  boundingBox?: BoundingBox
  /** Identifiant de piste stable entre frames (vidéos trackées). */
  trackId?: number | null
  /** Détection prioritaire (confiance ≥ seuil) ; les non prioritaires sont décochées par défaut. */
  priority?: boolean
}

/** Détections complètes d'une frame échantillonnée (lecteur vidéo annoté). */
export interface FrameDetections {
  t: number
  objects: DetectedObject[]
}

/** Bande-son identifiée par fingerprinting (reconnaissance musicale). */
export interface MusicInfo {
  artist: string
  title: string
  album?: string | null
  /** Lien d'écoute (page multi-plateformes AudD), si disponible. */
  link?: string | null
}

/** Tranche horodatée de la transcription audio. */
export interface TranscriptSegment {
  start: number
  end: number
  text: string
}

export interface Scene {
  label: string
  confidence: number
  indoor?: boolean | null
}

export interface Visualization {
  objects: DetectedObject[]
  scene: Scene
  colors: string[]
  text: string[]
  tags: string[]
}

export interface AnalysisResult {
  description: string
  visualization: Visualization
  model: string
  lang: string
  processingTime: number
  requestId: string
}

export type AnalyzeType = 'image' | 'video' | 'prompt'

// ─── Enregistrements persistés en base (lecture de l'historique) ─────────────

/** Présence d'objets à un instant donné d'une vidéo (chronologie d'apparition). */
export interface TimelineEntry {
  t: number
  labels: string[]
}

/** Une ligne de la table `analysis` (résumé persisté d'une analyse). */
export interface AnalysisRecord {
  id: string
  request_id: string
  type: AnalyzeType
  lang: string
  model: string
  processing_time_ms: number
  description: string
  scene_label: string
  scene_confidence: number
  indoor: boolean | null
  objects_count: number
  tags: string[]
  colors: string[]
  thumbnail_path: string | null
  timeline: TimelineEntry[] | null
  objects: DetectedObject[] | null
  source_width: number | null
  source_height: number | null
  audio_transcript: string | null
  video_path: string | null
  frame_detections: FrameDetections[] | null
  music: MusicInfo[] | null
  transcript_segments: TranscriptSegment[] | null
  created_at: string
}

/** Une ligne de la table `chat_exchange` (échange LLM persisté). */
export interface ChatExchangeRecord {
  id: string
  analysis_request_id: string | null
  question: string
  answer: string
  lang: string
  model: string
  created_at: string
}

// ─── Réponses paginées / enveloppes API ──────────────────────────────────────

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface ApiResponse<T> {
  success: boolean
  requestId: string
  processingTime: number
  result?: T
  error?: ApiError
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface HealthStatus {
  status: 'ok' | 'error'
  uptime: number
  db: 'ok' | 'error'
  ai: 'ok' | 'unreachable'
}

// ─── Paramètres de requête de l'historique ───────────────────────────────────

export type SortBy = 'created_at' | 'processing_time_ms' | 'type'
export type SortOrder = 'asc' | 'desc'

export interface AnalysesQuery {
  page?: number
  limit?: number
  type?: AnalyzeType
  sort_by?: SortBy
  sort_order?: SortOrder
}

// ─── Chat live (en mémoire pendant une session d'analyse) ────────────────────

export interface LiveChatMessage {
  id: string
  role: 'user' | 'bot' | 'error'
  content: string
  timestamp: Date
}

// ─── Compte utilisateur & préférences ────────────────────────────────────────

/** Identifiant de forfait d'abonnement (facturation factice). */
export type PlanId = 'free' | 'pro' | 'studio'

/** Forfait de l'API publique (distinct du forfait du site). */
export type ApiPlanId = 'free' | 'starter' | 'business' | 'unlimited'

export interface User {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  /** Forfait du site — pilote les quotas affichés et l'appel à l'action de montée en gamme. */
  plan: PlanId
  /** Forfait de l'API publique (indépendant du forfait du site). */
  apiPlan: ApiPlanId
  createdAt: string
}

/** Quotas et privilèges d'un forfait (toutes les offres ont la même puissance d'analyse). */
export interface PlanLimits {
  monthlyAnalyses: number
  monthlyVideoMinutes: number
  maxImageMb: number
  maxVideoMb: number
  queuePriority: number
}

/** Forfait courant et ses quotas. */
export interface PlanView {
  plan: PlanId
  limits: PlanLimits
}

/** Consommation mensuelle courante de l'utilisateur. */
export interface UsageView {
  plan: PlanId
  limits: PlanLimits
  usage: { analyses: number; videoMinutes: number }
  periodStart: string | null
  resetsAt: string
}

/** Charge courante de la passerelle (allocation de capacité). */
export interface CapacityStatus {
  maxConcurrent: number
  active: number
  queued: number
  busy: boolean
  avgAnalysisSeconds: number
}

// ─── API publique : forfait développeur + clés ───────────────────────────────

/** Quotas d'un forfait API. */
export interface ApiPlanLimits {
  monthlyRequests: number
  maxImageMb: number
  maxVideoMb: number
  rateLimitPerMin: number
  queuePriority: number
}

/** Forfait API courant et ses quotas. */
export interface ApiPlanView {
  plan: ApiPlanId
  limits: ApiPlanLimits
}

/** Consommation API mensuelle courante. */
export interface ApiUsageView {
  plan: ApiPlanId
  limits: ApiPlanLimits
  usage: { requests: number }
  /** Solde de tokens achetés (crédits de dépassement). */
  tokenBalance: number
  periodStart: string | null
  resetsAt: string
}

/** Pack de tokens API achetable. */
export type ApiTokenPackId = 'small' | 'medium' | 'large'

/** Vue publique d'une clé API (jamais le secret). */
export interface ApiKey {
  id: string
  name: string
  prefix: string
  lastUsedAt: string | null
  createdAt: string
}

/** Clé fraîchement créée : la vue + le secret en clair, montré une seule fois. */
export interface ApiKeyCreated extends ApiKey {
  secret: string
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system'
  density: 'comfortable' | 'compact'
}

export interface AnalysisSettings {
  defaultLang: string
  defaultType: 'file' | 'url' | 'prompt'
}

export interface UserSettings {
  appearance: AppearanceSettings
  analysis: AnalysisSettings
}

export const DEFAULT_SETTINGS: UserSettings = {
  appearance: { theme: 'system', density: 'comfortable' },
  analysis: { defaultLang: 'fr', defaultType: 'file' },
}

export interface SessionInfo {
  current: boolean
  userAgent: string | null
  ip: string
}

// ─── Conversations ───────────────────────────────────────────────────────────

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export type MessageRole = 'user' | 'assistant'
export type MessageKind = 'text' | 'analysis'

/** Analyse inlinée dans une carte de message assistant. */
export interface InlineAnalysis {
  id: string
  requestId: string
  type: AnalyzeType
  description: string
  model: string
  lang: string
  sceneLabel: string
  sceneConfidence: number
  indoor: boolean | null
  objects: DetectedObject[]
  colors: string[]
  tags: string[]
  timeline: TimelineEntry[] | null
  sourceWidth: number | null
  sourceHeight: number | null
  thumbnailUrl: string | null
  audioTranscript: string | null
  videoUrl: string | null
  frames: FrameDetections[] | null
  music: MusicInfo[] | null
  transcriptSegments: TranscriptSegment[] | null
}

export interface ConversationMessage {
  id: string
  role: MessageRole
  kind: MessageKind
  content: string
  attachmentName: string | null
  /** Statut serveur d'une carte d'analyse : « pending » (tâche de fond) → « ready » / « error ». */
  analysisStatus: 'pending' | 'ready' | 'error'
  seq: number
  createdAt: string
  analysis: InlineAnalysis | null
}

/** Message décoré côté client (état d'envoi optimiste ou flux interrompu). */
export type ClientMessage = ConversationMessage & {
  status?: 'sending' | 'error' | 'interrupted'
}

/** Pièce jointe en attente dans le composer ou le héros d'accueil. */
export type PendingAttachment =
  | {
      kind: 'file'
      file: File
      previewUrl: string | null
      thumbnailUrl: string | null
      isVideo: boolean
      durationS?: number
    }
  | { kind: 'url'; url: string; thumbnailUrl?: string | null }

// ─── Feed public « Global » ──────────────────────────────────────────────────

/** Vote sur une publication : +1, -1 ou 0 (aucun). */
export type PublicVote = -1 | 0 | 1

/** Tri du feed public. */
export type FeedSort = 'hot' | 'new' | 'top'

/** Auteur public (pseudo + avatar, jamais l'e-mail). */
export interface PublicationAuthor {
  name: string
  avatar: string | null
}

/** Snapshot d'affichage figé d'une analyse publiée (exclut le chat de suivi). */
export interface PublicationPayload {
  description: string
  model: string
  lang: string
  sceneLabel: string
  sceneConfidence: number
  indoor: boolean | null
  objectsCount: number
  tags: string[]
  colors: string[]
  sourceWidth: number | null
  sourceHeight: number | null
  timeline: TimelineEntry[] | null
  objects: DetectedObject[] | null
  frameDetections: FrameDetections[] | null
  music: MusicInfo[] | null
  transcriptSegments: TranscriptSegment[] | null
  audioTranscript: string | null
}

/** Publication du feed public. */
export interface Publication {
  id: string
  slug: string
  type: AnalyzeType
  caption: string | null
  author: PublicationAuthor
  payload: PublicationPayload
  hasThumbnail: boolean
  hasVideo: boolean
  upvotes: number
  downvotes: number
  score: number
  commentCount: number
  myVote: PublicVote
  /** Présent uniquement sur les réponses in-app : la publication appartient à l'utilisateur courant. */
  isMine?: boolean
  createdAt: string
}

/** Commentaire en fil d'une publication. */
export interface PublicationComment {
  id: string
  parentId: string | null
  author: PublicationAuthor
  body: string
  /** Présent uniquement sur les réponses in-app : le commentaire appartient à l'utilisateur courant. */
  isMine?: boolean
  createdAt: string
}

/** Résultat d'un vote (compteurs recalculés). */
export interface VoteResult {
  score: number
  upvotes: number
  downvotes: number
  myVote: PublicVote
}
