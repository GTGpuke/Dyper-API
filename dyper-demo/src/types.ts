// Sous-ensemble des types de l'API Dyper utilisés par la démo (cf. dyper-api/src/types).

export interface BoundingBox {
  x: number
  y: number
  w: number
  h: number
}

export interface DetectedObject {
  label: string
  confidence: number
  boundingBox?: BoundingBox
  /** Objet « prioritaire » de la scène (sinon secondaire) — change la couleur de la boîte. */
  priority?: boolean
}

export interface Scene {
  label: string
  confidence: number
  indoor?: boolean | null
}

export interface Visualization {
  objects: DetectedObject[]
  scene: Scene
  colors: string[]
  tags: string[]
}

export interface AnalysisResult {
  description: string
  sourceWidth: number | null
  sourceHeight: number | null
  visualization: Visualization
}

/** Source du flux temps réel. */
export type Source = 'camera' | 'screen'

/** Une entrée de la transcription cumulée. */
export interface LogEntry {
  id: number
  kind: 'detection' | 'marker' | 'error'
  time: string
  text: string
}
