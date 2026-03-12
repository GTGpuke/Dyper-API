// Fonctions utilitaires de gestion des fichiers : validation, prévisualisation et nettoyage mémoire.

// Types MIME acceptés par l'application.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
// Taille maximale autorisée en octets (10 Mo).
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Format de fichier non supporté. Utilisez JPEG, PNG, WebP, GIF ou MP4.' }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'Le fichier dépasse la taille maximale autorisée (10 Mo).' }
  }
  return { valid: true }
}

// Convertit un objet File en URL d'objet pour la prévisualisation.
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file)
}

// Révoque une URL d'objet pour libérer la mémoire.
export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url)
}
