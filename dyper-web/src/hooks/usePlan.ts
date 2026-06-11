// Forfait d'abonnement factice (vitrine marketing) : persisté en localStorage et partagé
// entre la page Forfaits et la sidebar via un événement. Aucune facturation réelle.
import { useCallback, useSyncExternalStore } from 'react'

export type PlanId = 'free' | 'pro' | 'studio'

const STORAGE_KEY = 'dyper-plan'
const PLAN_EVENT = 'dyper-plan-changed'

function readPlan(): PlanId {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'pro' || value === 'studio' ? value : 'free'
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(PLAN_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(PLAN_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

/** Forfait courant + sélection (mock) — synchronisé entre tous les composants montés. */
export function usePlan(): { plan: PlanId; setPlan: (plan: PlanId) => void } {
  const plan = useSyncExternalStore(subscribe, readPlan)

  const setPlan = useCallback((next: PlanId) => {
    localStorage.setItem(STORAGE_KEY, next)
    window.dispatchEvent(new Event(PLAN_EVENT))
  }, [])

  return { plan, setPlan }
}
