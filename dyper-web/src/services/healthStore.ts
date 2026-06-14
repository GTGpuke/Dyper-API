// Store de santé partagé : un unique sondage de /health pour toute l'application.
// Mémorise l'état courant (statut live) et un historique léger persisté dans le navigateur,
// qui alimente la frise de disponibilité de la page « Statut ». Le sondage ne tourne que
// lorsqu'au moins un composant est abonné (la barre latérale, montée en permanence, suffit).
import type { HealthStatus } from '../types'
import * as api from './api'

// Relevé compact persisté : horodatage (ms) + disponibilité passerelle/base et service IA.
export interface HealthSample {
  t: number
  db: boolean
  ai: boolean
}

const HISTORY_KEY = 'dyper-health-history'
const POLL_MS = 20_000 // Sondage live (statut global réactif).
const PERSIST_MS = 120_000 // Cadence d'enregistrement dans l'historique (échantillonnage réduit).
const MAX_SAMPLES = 12_000 // Plafond FIFO (~16 jours à un relevé toutes les 2 min).

let current: HealthStatus | null = null
let history: HealthSample[] = loadHistory()
let lastPersist = 0

const listeners = new Set<() => void>()
let pollTimer: ReturnType<typeof setInterval> | null = null

function loadHistory(): HealthSample[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // Stockage indisponible ou JSON corrompu : on repart d'un historique vide.
    return []
  }
}

function saveHistory(): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {
    // Quota dépassé ou stockage indisponible : l'historique reste en mémoire pour la session.
  }
}

function emit(): void {
  for (const listener of listeners) listener()
}

// Enregistre un relevé : à cadence réduite, mais immédiatement à tout changement d'état (incident).
function record(status: HealthStatus, now: number): void {
  const sample: HealthSample = { t: now, db: status.db === 'ok', ai: status.ai === 'ok' }
  const last = history[history.length - 1]
  const changed = !last || last.db !== sample.db || last.ai !== sample.ai
  if (!changed && now - lastPersist < PERSIST_MS) return

  const next = [...history, sample]
  history = next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next
  lastPersist = now
  saveHistory()
}

async function poll(): Promise<void> {
  const now = Date.now()
  try {
    current = await api.getHealth()
  } catch {
    current = { status: 'error', uptime: 0, db: 'error', ai: 'unreachable' }
  }
  record(current, now)
  emit()
}

/** Abonne un composant au store ; démarre le sondage au premier abonné, l'arrête au dernier. */
export function subscribeHealth(listener: () => void): () => void {
  listeners.add(listener)
  if (!pollTimer) {
    void poll()
    pollTimer = setInterval(() => void poll(), POLL_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }
}

/** Dernier statut live connu (référence remplacée à chaque sondage). */
export function getLiveHealth(): HealthStatus | null {
  return current
}

/** Historique persisté des relevés (référence remplacée uniquement à l'ajout d'un relevé). */
export function getHealthHistory(): HealthSample[] {
  return history
}
