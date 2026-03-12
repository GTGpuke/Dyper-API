// Service HTTP : encapsule tous les appels à l'API Dyper via Axios.
import axios from 'axios'
import type { ApiResponse, AnalysisResult } from '../types'

// Client Axios configuré avec l'URL de base et un timeout de 30 secondes.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30_000,
})

// Intercepteur de réponse : normalise les erreurs API en format unifié.
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

export async function analyzeFile(
  file: File,
  prompt?: string,
  lang = 'fr'
): Promise<AnalysisResult> {
  const form = new FormData()
  form.append('file', file)
  if (prompt) form.append('prompt', prompt)
  form.append('lang', lang)
  const { data } = await client.post<ApiResponse<AnalysisResult>>('/analyze', form)
  return data.result!
}

export async function analyzeUrl(
  url: string,
  prompt?: string,
  lang = 'fr'
): Promise<AnalysisResult> {
  const { data } = await client.post<ApiResponse<AnalysisResult>>('/analyze/url', { url, prompt, lang })
  return data.result!
}

export async function analyzePrompt(
  prompt: string,
  lang = 'fr'
): Promise<AnalysisResult> {
  const { data } = await client.post<ApiResponse<AnalysisResult>>('/analyze/prompt', { prompt, lang })
  return data.result!
}
