// Capacités dérivées d'une analyse persistée : source unique de vérité pour les cartes,
// les lignes et les filtres de l'historique (présence de vidéo, transcription, musique).
import type { AnalysisRecord } from '../types'

export type CapabilityId = 'video' | 'transcript' | 'music' | 'objects'

export interface AnalysisCapabilities {
  hasVideo: boolean
  hasTranscript: boolean
  hasMusic: boolean
  objectsCount: number
}

/** Calcule les capacités exploitables d'un enregistrement d'analyse. */
export function getCapabilities(record: AnalysisRecord): AnalysisCapabilities {
  const hasTranscript =
    Boolean(record.audio_transcript) || (record.transcript_segments?.length ?? 0) > 0
  return {
    hasVideo: Boolean(record.video_path),
    hasTranscript,
    hasMusic: (record.music?.length ?? 0) > 0,
    objectsCount: record.objects_count,
  }
}

/** Indique si un enregistrement possède la capacité demandée (filtrage). */
export function hasCapability(record: AnalysisRecord, capability: CapabilityId): boolean {
  const caps = getCapabilities(record)
  switch (capability) {
    case 'video':
      return caps.hasVideo
    case 'transcript':
      return caps.hasTranscript
    case 'music':
      return caps.hasMusic
    case 'objects':
      return caps.objectsCount > 0
  }
}
