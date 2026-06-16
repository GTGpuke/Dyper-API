// Persistance locale (localStorage) des vignettes d'analyse EN COURS, par conversation.
//
// Pendant qu'une analyse est en file/en traitement, le serveur n'a pas encore de miniature (elle
// n'est produite qu'à la fin). L'aperçu provient donc du client — mais un object URL (blob) meurt
// au reload et l'état React est perdu d'une analyse à l'autre. On persiste donc une vignette JPEG
// (data URL) par conversation : l'indicateur la retrouve AU RELOAD et lorsqu'une AUTRE analyse
// tourne en parallèle. À la fin de l'analyse, la vraie miniature serveur prend le relais.
import type { AnalyzingPreview } from '../components/chat/AnalyzingIndicator'

const KEY = 'dyper:analysisPreviews'
// Plafond d'entrées conservées (les plus anciennes sont écartées) : borne la taille en localStorage.
const MAX_ENTRIES = 12

interface StoredPreview {
  isVideo: boolean
  name: string | null
  durationS: number | null
  thumbnailUrl: string
  ts: number
}

function readAll(): Record<string, StoredPreview> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, StoredPreview>
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, StoredPreview>): void {
  try {
    const trimmed = Object.entries(map)
      .sort((a, b) => b[1].ts - a[1].ts)
      .slice(0, MAX_ENTRIES)
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(trimmed)))
  } catch {
    // Quota atteint ou contexte indisponible : sans gravité (l'aperçu retombera sur l'icône).
  }
}

/** Mémorise la vignette d'analyse d'une conversation (écrase l'éventuelle précédente). */
export function savePreview(
  conversationId: string,
  preview: { isVideo: boolean; name: string | null; durationS: number | null; thumbnailUrl: string },
  now: number
): void {
  const map = readAll()
  map[conversationId] = { ...preview, ts: now }
  writeAll(map)
}

/** Récupère la vignette persistée d'une conversation sous forme d'aperçu (image statique), ou null. */
export function loadPreview(conversationId: string): AnalyzingPreview | null {
  const stored = readAll()[conversationId]
  if (!stored) return null
  return {
    url: null,
    isVideo: stored.isVideo,
    name: stored.name,
    durationS: stored.durationS,
    thumbnailUrl: stored.thumbnailUrl,
  }
}
