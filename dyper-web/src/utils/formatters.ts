// Fonctions utilitaires de formatage pour l'affichage des données dans l'interface.

// Formate un score de confiance (0.0–1.0) en pourcentage lisible.
export function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`
}

// Formate un temps de traitement en millisecondes en chaîne lisible.
export function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

// Formate un timestamp Date en heure HH:MM.
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
