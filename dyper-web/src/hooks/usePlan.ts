// Forfait d'abonnement de l'utilisateur courant. La source de vérité est le serveur (le forfait
// est porté par le compte) ; la souscription passe par un paiement factice côté API. La facturation
// n'est pas réelle, mais les quotas associés au forfait sont, eux, appliqués par la passerelle.
import { useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import * as api from '../services/api'
import type { PlanId } from '../types'

export type { PlanId } from '../types'

/** Tailles de fichier autorisées par forfait (Mo). Miroir des quotas de la passerelle
 * (source de vérité côté serveur, `plan.service.ts`) — utilisé pour un retour immédiat à
 * l'utilisateur ; la passerelle reste l'autorité (réponse 413 en cas de dépassement). */
export const PLAN_FILE_LIMITS: Record<PlanId, { maxImageMb: number; maxVideoMb: number }> = {
  free: { maxImageMb: 10, maxVideoMb: 30 },
  pro: { maxImageMb: 20, maxVideoMb: 100 },
  studio: { maxImageMb: 20, maxVideoMb: 100 },
}

interface UsePlanReturn {
  plan: PlanId
  /** Tailles de fichier autorisées par le forfait courant (Mo). */
  fileLimits: { maxImageMb: number; maxVideoMb: number }
  /** Souscrit un forfait (paiement factice) puis rafraîchit la session. */
  subscribe: (plan: PlanId) => Promise<void>
}

/** Forfait courant (issu du compte) + limites de fichier + souscription factice. */
export function usePlan(): UsePlanReturn {
  const { user, refresh } = useAuth()
  const plan: PlanId = user?.plan ?? 'free'

  const subscribe = useCallback(
    async (next: PlanId) => {
      await api.checkout(next)
      await refresh()
    },
    [refresh]
  )

  return { plan, fileLimits: PLAN_FILE_LIMITS[plan], subscribe }
}
