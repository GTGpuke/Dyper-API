// Hook de gestion du cycle de vie d'une requête d'analyse vers l'API.
import { useState } from 'react'
import * as api from '../services/api'
import type { AnalyzeStatus, ApiError, AnalysisResult } from '../types'

interface UseAnalyzeReturn {
  status: AnalyzeStatus
  analyze: (
    onSuccess: (result: AnalysisResult) => void,
    onError: (error: ApiError) => void,
    text?: string,
    file?: File
  ) => Promise<void>
}

export function useAnalyze(): UseAnalyzeReturn {
  const [status, setStatus] = useState<AnalyzeStatus>('idle')

  async function analyze(
    onSuccess: (result: AnalysisResult) => void,
    onError: (error: ApiError) => void,
    text?: string,
    file?: File
  ): Promise<void> {
    setStatus('loading')
    try {
      let result: AnalysisResult
      if (file) {
        result = await api.analyzeFile(file, text)
      } else if (text) {
        result = await api.analyzePrompt(text)
      } else {
        throw { code: 'VALIDATION_ERROR', message: 'Veuillez fournir un fichier ou un texte.' }
      }
      setStatus('success')
      onSuccess(result)
    } catch (err) {
      setStatus('error')
      onError(err as ApiError)
    } finally {
      setStatus('idle')
    }
  }

  return { status, analyze }
}
