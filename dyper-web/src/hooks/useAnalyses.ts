// Hook de lecture de l'historique paginé des analyses depuis la base SQLite.
import { useCallback, useEffect, useState } from 'react'
import * as api from '../services/api'
import type { AnalysesQuery, AnalysisRecord, ApiError, Paginated } from '../types'

interface UseAnalysesReturn {
  data: Paginated<AnalysisRecord> | null
  loading: boolean
  error: ApiError | null
  refetch: () => void
}

export function useAnalyses(query: AnalysesQuery): UseAnalysesReturn {
  const [data, setData] = useState<Paginated<AnalysisRecord> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  // Sérialise la requête pour une dépendance stable de l'effet.
  const key = JSON.stringify(query)

  const fetch = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getAnalyses(query)
      .then((res) => {
        if (!cancelled) setData(res)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => fetch(), [fetch])

  return { data, loading, error, refetch: fetch }
}
