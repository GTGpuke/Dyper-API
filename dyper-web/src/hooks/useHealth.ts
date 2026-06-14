// Hooks de santé : statut live et historique de disponibilité, adossés à un store partagé
// (un seul sondage de /health pour toute l'application, cf. services/healthStore).
import { useSyncExternalStore } from 'react'
import {
  getHealthHistory,
  getLiveHealth,
  type HealthSample,
  subscribeHealth,
} from '../services/healthStore'
import type { HealthStatus } from '../types'

/** Statut courant de la passerelle (base + service IA), rafraîchi périodiquement. */
export function useHealth(): HealthStatus | null {
  return useSyncExternalStore(subscribeHealth, getLiveHealth)
}

/** Historique des relevés de santé (alimente la frise de disponibilité de la page Statut). */
export function useHealthHistory(): HealthSample[] {
  return useSyncExternalStore(subscribeHealth, getHealthHistory)
}
