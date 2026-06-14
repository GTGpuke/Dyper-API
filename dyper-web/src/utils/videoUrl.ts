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

// Motifs d'extraction de l'identifiant d'une vidéo YouTube (miniature déductible de l'URL).
const YOUTUBE_ID_PATTERNS: RegExp[] = [
  /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/i,
  /youtu\.be\/([\w-]{11})/i,
  /youtube\.com\/shorts\/([\w-]{11})/i,
]

/** Miniature YouTube déductible de l'URL (null pour les autres plateformes : à résoudre côté serveur). */
export function youtubeThumbnailUrl(url: string): string | null {
  const trimmed = url.trim()
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`
  }
  return null
}
