// Détection des URLs de plateformes vidéo prises en charge (YouTube, Twitch).
// Une URL détectée est routée vers l'analyse vidéo complète (téléchargement côté dyper-ai).

const PLATFORM_PATTERNS: RegExp[] = [
  // YouTube : watch, lien court, shorts.
  /^https?:\/\/(www\.|m\.)?youtube\.com\/(watch\?|shorts\/)/i,
  /^https?:\/\/youtu\.be\/[\w-]+/i,
  // Twitch : clips (deux formes) et VOD.
  /^https?:\/\/clips\.twitch\.tv\/[\w-]+/i,
  /^https?:\/\/(www\.)?twitch\.tv\/[\w-]+\/clip\/[\w-]+/i,
  /^https?:\/\/(www\.)?twitch\.tv\/videos\/\d+/i,
];

/** Indique si l'URL pointe vers une vidéo de plateforme prise en charge. */
export function isVideoPlatformUrl(url: string): boolean {
  return PLATFORM_PATTERNS.some((pattern) => pattern.test(url.trim()));
}
