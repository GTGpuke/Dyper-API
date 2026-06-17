// Client minimal de l'API Dyper pour la démo. Tous les appels passent par le proxy Vite (même
// origine) : le cookie de session et l'en-tête X-App-Key transitent normalement, sans CORS.
import type { AnalysisResult } from './types'

// Clé applicative exigée sur /api/auth et /api/me. Surchargée par VITE_APP_KEY, sinon valeur de
// développement (cf. dyper-api/src/services/env.service.ts).
const APP_KEY = import.meta.env.VITE_APP_KEY || 'dev-appkey-0123456789abcdef0123456789abcdef'

// Erreur API typée : porte le code normalisé et le statut HTTP pour décider du comportement
// (429 = débit transitoire, 402 « QUOTA_EXCEEDED » = quota mensuel épuisé, etc.).
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly status: number,
    readonly retryAfter = 0
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Extrait { code, message } d'une réponse d'erreur normalisée { error: { code, message } }.
async function readError(res: Response): Promise<{ code: string | null; message: string }> {
  try {
    const data = await res.json()
    const err = data?.error ?? {}
    return { code: err.code ?? null, message: err.message ?? data?.message ?? `HTTP ${res.status}` }
  } catch {
    return { code: null, message: `HTTP ${res.status}` }
  }
}

/** Connecte (ou inscrit) l'utilisateur : ouvre une session par cookie (requise pour créer une clé). */
export async function authenticate(email: string, password: string, register: boolean): Promise<void> {
  const res = await fetch(register ? '/api/auth/register' : '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Key': APP_KEY },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const { code, message } = await readError(res)
    throw new ApiError(message, code, res.status)
  }
}

/** Génère une clé API et renvoie son secret (montré une seule fois par la passerelle). */
export async function createApiKey(): Promise<string> {
  const res = await fetch('/api/v1/me/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Key': APP_KEY },
    credentials: 'include',
    body: JSON.stringify({ name: 'Démo temps réel' }),
  })
  if (!res.ok) {
    const { code, message } = await readError(res)
    throw new ApiError(message, code, res.status)
  }
  const { key } = await res.json()
  return key.secret as string
}

/**
 * Analyse une image (frame) authentifiée UNIQUEMENT par la clé API (Authorization: Bearer …).
 * `realtime=true` -> frame de preview (ni persistée, ni décomptée du quota).
 * `fast=true` (défaut) -> détection seule (rapide, pour les boîtes en direct).
 * `fast=false` -> pipeline complet avec description en langage naturel (pour la narration).
 */
export async function analyzeFrame(
  apiKey: string,
  blob: Blob,
  fast = true
): Promise<AnalysisResult> {
  const form = new FormData()
  form.append('file', blob, 'frame.jpg')
  form.append('realtime', 'true')
  form.append('fast', String(fast))
  const res = await fetch('/api/v1/analyze', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) {
    const { code, message } = await readError(res)
    const retryAfter = Number(res.headers.get('x-ratelimit-reset')) || 3
    throw new ApiError(message, code, res.status, retryAfter)
  }
  const data = await res.json()
  return data.result as AnalysisResult
}
