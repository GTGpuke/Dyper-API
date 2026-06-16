// Fonctions utilitaires de gestion des fichiers : validation (type, taille, durée), prévisualisation.

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const VIDEO_MIME_TYPES = ['video/mp4']

// Tailles maximales par défaut (Mo) — bornes hautes (forfaits payants). Les limites réelles
// dépendent du forfait et sont fournies par l'appelant via usePlan().fileLimits.
const DEFAULT_LIMITS = { maxImageMb: 20, maxVideoMb: 100 }

// Durée maximale autorisée pour une vidéo (secondes) — indépendante du forfait.
export const VIDEO_MAX_DURATION_S = 300

// Indique si le fichier est une vidéo.
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

// Résultat de validation : la raison permet à l'appelant de choisir un message traduit.
export type FileCheck = { valid: true } | { valid: false; reason: 'type' | 'imageSize' | 'videoSize' }

/** Valide type et taille selon les limites du forfait courant (Mo). */
export function validateFile(
  file: File,
  limits: { maxImageMb: number; maxVideoMb: number } = DEFAULT_LIMITS
): FileCheck {
  const isImage = IMAGE_MIME_TYPES.includes(file.type)
  const isVideo = VIDEO_MIME_TYPES.includes(file.type)
  if (!isImage && !isVideo) return { valid: false, reason: 'type' }
  if (isImage && file.size > limits.maxImageMb * 1024 * 1024) {
    return { valid: false, reason: 'imageSize' }
  }
  if (isVideo && file.size > limits.maxVideoMb * 1024 * 1024) {
    return { valid: false, reason: 'videoSize' }
  }
  return { valid: true }
}

// Capture la première image d'une vidéo locale en vignette (data URL JPEG), entièrement côté
// navigateur. Retourne null si la frame ne peut pas être extraite (format, délai dépassé).
export function getVideoThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    let settled = false
    const finish = (result: string | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(result)
    }
    const timer = setTimeout(() => finish(null), 5000)
    video.onloadeddata = () => {
      // Léger décalage pour éviter une éventuelle frame noire d'amorçage.
      video.currentTime = Math.min(0.1, video.duration || 0)
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx || !canvas.width || !canvas.height) {
          finish(null)
          return
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL('image/jpeg', 0.7))
      } catch {
        finish(null)
      }
    }
    video.onerror = () => finish(null)
    video.src = url
  })
}

/**
 * Génère une vignette JPEG (data URL) réduite à partir d'un fichier image. Sert d'aperçu PERSISTANT
 * pour l'indicateur d'analyse (data URL → survit au reload et au stockage local, contrairement à un
 * object URL). Retourne null en cas d'échec.
 */
export function getImageThumbnail(file: File, maxDim = 320): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      } catch {
        resolve(null)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
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
