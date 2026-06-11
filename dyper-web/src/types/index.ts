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
  music: MusicInfo | null
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

export interface User {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  createdAt: string
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
  music: MusicInfo | null
}

export interface ConversationMessage {
  id: string
  role: MessageRole
  kind: MessageKind
  content: string
  attachmentName: string | null
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
  | { kind: 'file'; file: File; previewUrl: string | null; isVideo: boolean; durationS?: number }
  | { kind: 'url'; url: string }
