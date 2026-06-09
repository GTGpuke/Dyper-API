// Hook de gestion du cycle de vie d'une requête d'analyse vers l'API.
import { useState } from 'react'
import * as api from '../services/api'
import type { AnalysisResult, ApiError } from '../types'

type Status = 'idle' | 'loading' | 'success' | 'error'

export type AnalyzeInput =
  | { kind: 'file'; file: File; prompt?: string; lang?: string }
  | { kind: 'url'; url: string; prompt?: string; lang?: string }
  | { kind: 'prompt'; prompt: string; lang?: string }

interface UseAnalyzeReturn {
  status: Status
  result: AnalysisResult | null
  error: ApiError | null
  run: (input: AnalyzeInput) => Promise<AnalysisResult | null>
  reset: () => void
}

export function useAnalyze(): UseAnalyzeReturn {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  async function run(input: AnalyzeInput): Promise<AnalysisResult | null> {
    setStatus('loading')
    setError(null)
    try {
      let res: AnalysisResult
      if (input.kind === 'file') res = await api.analyzeFile(input.file, input.prompt, input.lang)
      else if (input.kind === 'url') res = await api.analyzeUrl(input.url, input.prompt, input.lang)
      else res = await api.analyzePrompt(input.prompt, input.lang)
      setResult(res)
      setStatus('success')
      return res
    } catch (err) {
      setError(err as ApiError)
      setStatus('error')
      return null
    }
  }

  function reset(): void {
    setStatus('idle')
    setResult(null)
    setError(null)
  }

  return { status, result, error, run, reset }
}
