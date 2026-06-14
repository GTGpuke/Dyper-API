// Service HTTP : encapsule tous les appels à la passerelle Dyper via Axios.
import axios from 'axios'
import type {
  AnalysesQuery,
  AnalysisRecord,
  AnalysisResult,
  ApiResponse,
  ChatExchangeRecord,
  Conversation,
  ConversationMessage,
  FeedSort,
  HealthStatus,
  Paginated,
  Publication,
  PublicationComment,
  PublicVote,
  SessionInfo,
  User,
  UserSettings,
  VoteResult,
} from '../types'
import { isVideoPlatformUrl } from '../utils/videoUrl'

// Client Axios : URL de base (vide en dev → proxy Vite, cookie first-party), timeout 60 s,
// clé applicative (X-App-Key) et envoi des cookies de session (withCredentials).
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 60_000,
  withCredentials: true,
  headers: {
    'X-App-Key': import.meta.env.VITE_APP_KEY ?? '',
  },
})

// Intercepteur de réponse : normalise les erreurs API au format unifié { code, message }.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const apiError = err.response?.data?.error ?? {
      code: 'NETWORK_ERROR',
      message: 'Impossible de joindre le serveur.',
    }
    return Promise.reject(apiError)
  }
)

// Fusionne le résultat avec le temps de traitement de l'enveloppe (le champ vit au niveau racine).
function unwrap(data: ApiResponse<AnalysisResult>): AnalysisResult {
  const result = data.result as AnalysisResult
  return { ...result, processingTime: data.processingTime ?? result.processingTime }
}

// ─── Analyse (écriture → persistée en base par la passerelle) ────────────────

export async function analyzeFile(file: File, prompt?: string, lang = 'fr'): Promise<AnalysisResult> {
  const form = new FormData()
  form.append('file', file)
  if (prompt) form.append('prompt', prompt)
  form.append('lang', lang)
  // L'analyse vidéo à fond (900 frames + chapitres) peut durer plusieurs minutes.
  const timeout = file.type.startsWith('video/') ? 900_000 : undefined
  const { data } = await client.post<ApiResponse<AnalysisResult>>('/api/analyze', form, { timeout })
  return unwrap(data)
}

/** Résout la miniature d'une vidéo de plateforme via la passerelle (null si indisponible). */
export async function fetchVideoThumbnail(url: string): Promise<string | null> {
  try {
    const { data } = await client.post<{ thumbnailUrl: string | null }>('/api/analyze/thumbnail', {
      url,
    })
    return data.thumbnailUrl ?? null
  } catch {
    return null
  }
}

export async function analyzeUrl(url: string, prompt?: string, lang = 'fr'): Promise<AnalysisResult> {
  const { data } = await client.post<ApiResponse<AnalysisResult>>('/api/analyze/url', {
    url,
    prompt,
    lang,
  })
  return unwrap(data)
}

export async function analyzePrompt(prompt: string, lang = 'fr'): Promise<AnalysisResult> {
  const { data } = await client.post<ApiResponse<AnalysisResult>>('/api/analyze/prompt', {
    prompt,
    lang,
  })
  return unwrap(data)
}

export async function chatWithResult(
  question: string,
  context: AnalysisResult,
  lang = 'fr'
): Promise<string> {
  const { data } = await client.post<{ success: boolean; answer: string }>('/api/chat', {
    question,
    context,
    lang,
  })
  return data.answer
}

// ─── Historique (lecture depuis la base SQLite) ──────────────────────────────

export async function getAnalyses(query: AnalysesQuery = {}): Promise<Paginated<AnalysisRecord>> {
  const { data } = await client.get<Paginated<AnalysisRecord>>('/api/analyses', { params: query })
  return data
}

export async function getAnalysis(id: string): Promise<AnalysisRecord> {
  const { data } = await client.get<{ data: AnalysisRecord }>(`/api/analyses/${id}`)
  return data.data
}

// Supprime une analyse (et, côté serveur, ses échanges de chat liés et ses médias).
export async function deleteAnalysis(id: string): Promise<void> {
  await client.delete(`/api/analyses/${id}`)
}

export async function getChatHistory(requestId: string): Promise<ChatExchangeRecord[]> {
  const { data } = await client.get<{ data: ChatExchangeRecord[]; total: number }>(
    `/api/analyses/${requestId}/chat`
  )
  return data.data
}

// ─── Santé (DB + dyper-ai) — route publique, sans clé applicative ────────────

export async function getHealth(): Promise<HealthStatus> {
  const { data } = await client.get<HealthStatus>('/health')
  return data
}

// ─── Testeur de la documentation ─────────────────────────────────────────────

/**
 * Exécute une requête GET brute pour le testeur « Essayer » de la documentation :
 * retourne le statut HTTP et le corps tels quels, sans jamais rejeter.
 */
export async function probe(path: string): Promise<{ status: number; body: unknown }> {
  try {
    const { status, data } = await client.get<unknown>(path, { validateStatus: () => true })
    return { status, body: data }
  } catch (error) {
    return { status: 0, body: { success: false, error } }
  }
}

// ─── Authentification ────────────────────────────────────────────────────────

export async function register(email: string, password: string, displayName?: string): Promise<User> {
  const { data } = await client.post<{ user: User }>('/api/auth/register', {
    email,
    password,
    displayName,
  })
  return data.user
}

export async function login(email: string, password: string): Promise<User> {
  const { data } = await client.post<{ user: User }>('/api/auth/login', { email, password })
  return data.user
}

export async function logout(): Promise<void> {
  await client.post('/api/auth/logout')
}

// ─── Compte courant (/api/me) ────────────────────────────────────────────────

export async function getMe(): Promise<{ user: User; settings: UserSettings }> {
  const { data } = await client.get<{ user: User; settings: UserSettings }>('/api/me')
  return { user: data.user, settings: data.settings }
}

export async function updateProfile(payload: {
  displayName?: string
  avatarUrl?: string
  bio?: string
}): Promise<User> {
  const { data } = await client.patch<{ user: User }>('/api/me/profile', payload)
  return data.user
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await client.patch('/api/me/password', { currentPassword, newPassword })
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const { data } = await client.put<{ settings: UserSettings }>('/api/me/settings', patch)
  return data.settings
}

export async function getSessions(): Promise<SessionInfo[]> {
  const { data } = await client.get<{ sessions: SessionInfo[] }>('/api/me/sessions')
  return data.sessions
}

export async function revokeAllSessions(): Promise<void> {
  await client.post('/api/me/sessions/revoke-all')
}

export async function exportData(): Promise<Blob> {
  const { data } = await client.get('/api/me/export', { responseType: 'blob' })
  return data as Blob
}

export async function purgeHistory(type?: string): Promise<number> {
  const { data } = await client.delete<{ deleted: number }>('/api/me/history', {
    data: { type },
  })
  return data.deleted
}

export async function deleteAccount(password: string): Promise<void> {
  await client.delete('/api/me/account', { data: { password } })
}

// ─── Conversations ───────────────────────────────────────────────────────────

export async function listConversations(): Promise<Conversation[]> {
  const { data } = await client.get<{ data: Conversation[] }>('/api/conversations', {
    params: { limit: 200 },
  })
  return data.data
}

export async function createConversation(): Promise<Conversation> {
  const { data } = await client.post<{ conversation: Conversation }>('/api/conversations', {})
  return data.conversation
}

export async function getConversation(
  id: string
): Promise<{ conversation: Conversation; messages: ConversationMessage[] }> {
  const { data } = await client.get<{ conversation: Conversation; messages: ConversationMessage[] }>(
    `/api/conversations/${id}`
  )
  return data
}

export async function renameConversation(id: string, title: string): Promise<Conversation> {
  const { data } = await client.patch<{ conversation: Conversation }>(`/api/conversations/${id}`, {
    title,
  })
  return data.conversation
}

export async function deleteConversation(id: string): Promise<void> {
  await client.delete(`/api/conversations/${id}`)
}

/** Envoie un message (texte, fichier ou URL) et retourne la paire user/assistant créée. */
export async function sendConversationMessage(
  id: string,
  input: { text?: string; file?: File; url?: string; lang?: string },
  onUploadProgress?: (pct: number) => void
): Promise<{ conversation: Conversation; messages: ConversationMessage[] }> {
  if (input.file) {
    const form = new FormData()
    form.append('file', input.file)
    if (input.text) form.append('text', input.text)
    form.append('lang', input.lang ?? 'fr')
    // L'analyse vidéo à fond (900 frames + chapitres) peut durer plusieurs minutes.
    const timeout = input.file.type.startsWith('video/') ? 900_000 : undefined
    const { data } = await client.post<{
      conversation: Conversation
      messages: ConversationMessage[]
    }>(`/api/conversations/${id}/messages`, form, {
      timeout,
      onUploadProgress: (event) => {
        if (onUploadProgress && event.total) {
          onUploadProgress(Math.round((event.loaded / event.total) * 100))
        }
      },
    })
    return data
  }
  // Une URL de plateforme vidéo (YouTube / Twitch) implique téléchargement + analyse complète :
  // timeout étendu comme pour un fichier vidéo.
  const timeout = input.url && isVideoPlatformUrl(input.url) ? 900_000 : undefined
  const { data } = await client.post<{
    conversation: Conversation
    messages: ConversationMessage[]
  }>(
    `/api/conversations/${id}/messages`,
    {
      text: input.text,
      url: input.url,
      lang: input.lang ?? 'fr',
    },
    { timeout }
  )
  return data
}

/** URL d'une miniature d'analyse (servie par cookie — utilisable dans un <img src>). */
export function mediaUrl(requestId: string): string {
  return `${import.meta.env.VITE_API_URL ?? ''}/api/media/${requestId}`
}

/** URL de la vidéo originale d'une analyse (streaming Range — utilisable dans un <video src>). */
export function videoUrl(requestId: string): string {
  return `${import.meta.env.VITE_API_URL ?? ''}/api/media/${requestId}/video`
}

// ─── Feed public « Global » ──────────────────────────────────────────────────

export async function publishAnalysis(analysisId: string, caption?: string): Promise<Publication> {
  const { data } = await client.post<{ publication: Publication }>('/api/global/publish', {
    analysisId,
    caption,
  })
  return data.publication
}

export async function getGlobalFeed(sort: FeedSort, page = 1): Promise<Paginated<Publication>> {
  const { data } = await client.get<Paginated<Publication>>('/api/global', {
    params: { sort, page },
  })
  return data
}

export async function getPublication(id: string): Promise<Publication> {
  const { data } = await client.get<{ publication: Publication }>(`/api/global/publications/${id}`)
  return data.publication
}

export async function votePublication(id: string, value: PublicVote): Promise<VoteResult> {
  const { data } = await client.post<VoteResult>(`/api/global/publications/${id}/vote`, { value })
  return data
}

export async function deletePublication(id: string): Promise<void> {
  await client.delete(`/api/global/publications/${id}`)
}

export async function getPublicationComments(id: string): Promise<PublicationComment[]> {
  const { data } = await client.get<{ data: PublicationComment[] }>(
    `/api/global/publications/${id}/comments`
  )
  return data.data
}

export async function postComment(
  id: string,
  body: string,
  parentId?: string
): Promise<PublicationComment> {
  const { data } = await client.post<{ comment: PublicationComment }>(
    `/api/global/publications/${id}/comments`,
    { body, parentId }
  )
  return data.comment
}

export async function deleteComment(commentId: string): Promise<void> {
  await client.delete(`/api/global/comments/${commentId}`)
}

export async function reportPublication(id: string, reason: string): Promise<void> {
  await client.post(`/api/global/publications/${id}/report`, { reason })
}

export async function reportComment(commentId: string, reason: string): Promise<void> {
  await client.post(`/api/global/comments/${commentId}/report`, { reason })
}

// ─── Pages publiques (sans connexion) ────────────────────────────────────────

export async function getPublicPublication(
  slug: string
): Promise<{ publication: Publication; comments: PublicationComment[] }> {
  const { data } = await client.get<{ publication: Publication; comments: PublicationComment[] }>(
    `/api/public/publications/${slug}`
  )
  return data
}

/** URL publique d'une miniature de publication (utilisable dans un <img src>, sans session). */
export function publicMediaUrl(slug: string): string {
  return `${import.meta.env.VITE_API_URL ?? ''}/api/public/media/${slug}`
}

/** URL publique de la vidéo d'une publication (streaming Range, sans session). */
export function publicVideoUrl(slug: string): string {
  return `${import.meta.env.VITE_API_URL ?? ''}/api/public/media/${slug}/video`
}
