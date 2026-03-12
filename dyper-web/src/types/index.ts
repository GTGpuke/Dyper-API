// Définition de tous les types partagés de l'application Dyper Web.

// ─── Messages du chat ───────────────────────────────────────────────────────

export type MessageRole = 'user' | 'bot' | 'error'

export interface ChatMessage {
  id: string
  role: MessageRole
  timestamp: Date
  content: MessageContent
}

export type MessageContent =
  | UserTextContent
  | UserImageContent
  | BotResultContent
  | ErrorContent

export interface UserTextContent {
  type: 'text'
  text: string
}

export interface UserImageContent {
  type: 'image'
  text?: string
  file: File
  previewUrl: string
}

export interface BotResultContent {
  type: 'result'
  result: AnalysisResult
}

export interface ErrorContent {
  type: 'error'
  message: string
  code: string
}

// ─── Résultat d'analyse ──────────────────────────────────────────────────────

export interface AnalysisResult {
  description: string
  visualization: Visualization
  model: string
  lang: string
  processingTime: number
  requestId: string
}

export interface Visualization {
  objects: DetectedObject[]
  scene: Scene
  colors: string[]
  text: string[]
  tags: string[]
}

export interface DetectedObject {
  label: string
  confidence: number
  boundingBox?: BoundingBox
}

export interface BoundingBox {
  x: number
  y: number
  w: number
  h: number
}

export interface Scene {
  label: string
  confidence: number
  indoor?: boolean
}

// ─── État de l'application ───────────────────────────────────────────────────

export type AnalyzeStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AnalyzeState {
  status: AnalyzeStatus
  error: string | null
}

// ─── API ─────────────────────────────────────────────────────────────────────

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
