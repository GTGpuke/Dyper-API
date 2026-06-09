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
