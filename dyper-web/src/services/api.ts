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
  HealthStatus,
  Paginated,
  SessionInfo,
  User,
  UserSettings,
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
  // L'analyse vidéo est plus longue (nombreuses images) : timeout étendu côté client.
  const timeout = file.type.startsWith('video/') ? 180_000 : undefined
  const { data } = await client.post<ApiResponse<AnalysisResult>>('/api/analyze', form, { timeout })
  return unwrap(data)
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
    // L'analyse vidéo est plus longue (nombreuses images) : timeout étendu côté client.
    const timeout = input.file.type.startsWith('video/') ? 180_000 : undefined
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
  const timeout = input.url && isVideoPlatformUrl(input.url) ? 240_000 : undefined
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
