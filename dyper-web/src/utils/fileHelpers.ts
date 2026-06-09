// Fonctions utilitaires de gestion des fichiers : validation (type, taille, durée), prévisualisation.

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const VIDEO_MIME_TYPES = ['video/mp4']

// Tailles maximales par type.
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10 Mo
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024 // 100 Mo

// Durée maximale autorisée pour une vidéo (secondes).
export const VIDEO_MAX_DURATION_S = 300

// Indique si le fichier est une vidéo.
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

// Résultat de validation : la raison permet à l'appelant de choisir un message traduit.
export type FileCheck = { valid: true } | { valid: false; reason: 'type' | 'imageSize' | 'videoSize' }

export function validateFile(file: File): FileCheck {
  const isImage = IMAGE_MIME_TYPES.includes(file.type)
  const isVideo = VIDEO_MIME_TYPES.includes(file.type)
  if (!isImage && !isVideo) return { valid: false, reason: 'type' }
  if (isImage && file.size > MAX_IMAGE_SIZE_BYTES) return { valid: false, reason: 'imageSize' }
  if (isVideo && file.size > MAX_VIDEO_SIZE_BYTES) return { valid: false, reason: 'videoSize' }
  return { valid: true }
}

// Lit la durée d'une vidéo (secondes) via ses métadonnées, sans la télécharger entièrement.
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Lecture des métadonnées vidéo impossible.'))
    }
    video.src = url
  })
}
