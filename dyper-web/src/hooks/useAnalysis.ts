// Hook de lecture du détail d'une analyse + de son historique de chat persisté.
import { useEffect, useState } from 'react'
import * as api from '../services/api'
import type { AnalysisRecord, ApiError, ChatExchangeRecord } from '../types'

interface UseAnalysisReturn {
  analysis: AnalysisRecord | null
  chat: ChatExchangeRecord[]
  loading: boolean
  error: ApiError | null
}

export function useAnalysis(id: string | undefined): UseAnalysisReturn {
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null)
  const [chat, setChat] = useState<ChatExchangeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .getAnalysis(id)
      .then(async (record) => {
        if (cancelled) return
        setAnalysis(record)
        // L'historique de chat est lié par request_id (pas l'id de ligne).
        const exchanges = await api.getChatHistory(record.request_id).catch(() => [])
        if (!cancelled) setChat(exchanges)
      })
      .catch((err) => {
        if (!cancelled) setError(err as ApiError)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  return { analysis, chat, loading, error }
}
