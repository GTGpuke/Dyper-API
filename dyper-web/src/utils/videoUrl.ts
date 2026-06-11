// Détection des URLs de plateformes vidéo prises en charge (YouTube, Twitch).
// Miroir du helper de la passerelle : sert à allonger le timeout client (téléchargement + analyse).

const PLATFORM_PATTERNS: RegExp[] = [
  /^https?:\/\/(www\.|m\.)?youtube\.com\/(watch\?|shorts\/)/i,
  /^https?:\/\/youtu\.be\/[\w-]+/i,
  /^https?:\/\/clips\.twitch\.tv\/[\w-]+/i,
  /^https?:\/\/(www\.)?twitch\.tv\/[\w-]+\/clip\/[\w-]+/i,
  /^https?:\/\/(www\.)?twitch\.tv\/videos\/\d+/i,
]

/** Indique si l'URL pointe vers une vidéo de plateforme prise en charge. */
export function isVideoPlatformUrl(url: string): boolean {
  return PLATFORM_PATTERNS.some((pattern) => pattern.test(url.trim()))
}
