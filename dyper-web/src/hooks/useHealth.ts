// Hook de surveillance de la santé de la passerelle (DB + dyper-ai), rafraîchi périodiquement.
import { useEffect, useState } from 'react'
import * as api from '../services/api'
import type { HealthStatus } from '../types'

export function useHealth(intervalMs = 20_000): HealthStatus | null {
  const [health, setHealth] = useState<HealthStatus | null>(null)

  useEffect(() => {
    let active = true
    const poll = () => {
      api
        .getHealth()
        .then((h) => active && setHealth(h))
        .catch(() => active && setHealth({ status: 'error', uptime: 0, db: 'error', ai: 'unreachable' }))
    }
    poll()
    const timer = setInterval(poll, intervalMs)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [intervalMs])

  return health
}
