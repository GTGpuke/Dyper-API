// Fonctions utilitaires de formatage pour l'affichage des données dans l'interface.

// Formate un score de confiance (0.0–1.0) en pourcentage lisible.
export function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`
}

// Formate un temps de traitement en millisecondes en chaîne lisible.
export function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

// Locale BCP-47 à partir du code de langue applicatif.
function locale(lang: string): string {
  return lang === 'en' ? 'en-US' : 'fr-FR'
}

// Formate une date ISO en date+heure lisible, dans la langue donnée.
export function formatDateTime(iso: string, lang = 'fr'): string {
  return new Date(iso).toLocaleString(locale(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Formate une date ISO en durée relative concise (Intl.RelativeTimeFormat), dans la langue donnée.
export function formatRelative(iso: string, lang = 'fr'): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  const sec = Math.round(diffMs / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' })
  const abs = Math.abs(sec)
  if (abs < 60) return rtf.format(Math.round(sec), 'second')
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour')
  if (abs < 2592000) return rtf.format(Math.round(sec / 86400), 'day')
  return formatDateTime(iso, lang)
}

// Met en forme un grand nombre avec séparateurs de milliers.
export function formatNumber(n: number, lang = 'fr'): string {
  return n.toLocaleString(locale(lang))
}

// Formate une taille en octets en chaîne lisible (Ko / Mo).
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// Formate une durée en secondes au format m:ss (ex. 75 → « 1:15 »).
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Groupes de récence pour la liste des conversations. */
export type RecencyGroup = 'today' | 'yesterday' | 'week' | 'older'

// Classe une date ISO dans un groupe de récence (aujourd'hui / hier / 7 jours / plus ancien).
export function recencyGroup(iso: string): RecencyGroup {
  const date = new Date(iso)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  if (date >= startOfToday) return 'today'
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  if (date >= startOfYesterday) return 'yesterday'
  const weekAgo = new Date(startOfToday)
  weekAgo.setDate(weekAgo.getDate() - 7)
  if (date >= weekAgo) return 'week'
  return 'older'
}
