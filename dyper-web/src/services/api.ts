// Service HTTP : encapsule tous les appels à la passerelle Dyper via Axios.
import axios from 'axios'
import type { AnalysisResult, ApiResponse } from '../types'

// Client Axios : URL de base, timeout 30 s et clé applicative (header X-App-Key) sur chaque requête.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30_000,
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

export async function analyzeFile(file: File, prompt?: string, lang = 'fr'): Promise<AnalysisResult> {
  const form = new FormData()
  form.append('file', file)
  if (prompt) form.append('prompt', prompt)
  form.append('lang', lang)
  const { data } = await client.post<ApiResponse<AnalysisResult>>('/api/analyze', form)
  return data.result!
}

export async function analyzeUrl(url: string, prompt?: string, lang = 'fr'): Promise<AnalysisResult> {
  const { data } = await client.post<ApiResponse<AnalysisResult>>('/api/analyze/url', {
    url,
    prompt,
    lang,
  })
  return data.result!
}

export async function analyzePrompt(prompt: string, lang = 'fr'): Promise<AnalysisResult> {
  const { data } = await client.post<ApiResponse<AnalysisResult>>('/api/analyze/prompt', {
    prompt,
    lang,
  })
  return data.result!
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
