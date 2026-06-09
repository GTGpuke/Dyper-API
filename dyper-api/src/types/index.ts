// Types de domaine partagés de la passerelle Dyper.
// Le contrat de réponse reproduit fidèlement celui documenté dans docs/docs.md (§3).

/** Boîte englobante d'un objet détecté, en pixels. */
export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Objet détecté par le modèle (label COCO brut en anglais). */
export interface DetectedObject {
  label: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

/** Scène inférée à partir des objets détectés. */
export interface Scene {
  label: string;
  confidence: number;
  indoor?: boolean | null;
}

/** Bloc de visualisation structurée retourné par dyper-ai. */
export interface Visualization {
  objects: DetectedObject[];
  scene: Scene;
  colors: string[];
  text: string[];
  tags: string[];
}

/** Réponse brute du service d'inférence dyper-ai (POST /process). */
export interface ProcessAiResponse {
  requestId: string;
  description: string;
  visualization: Visualization;
  model: string;
  processingTimeMs: number;
}

/** Résultat exposé au client (réponse dyper-ai enrichie de la langue). */
export type AnalysisResult = ProcessAiResponse & { lang: string };

/** Type d'analyse demandé au service d'inférence. */
export type AnalyzeType = 'image' | 'video' | 'prompt';

/** Options transmises au service ai.service pour appeler dyper-ai. */
export interface ProcessOptions {
  requestId: string;
  fileBuffer?: Buffer;
  mimetype?: string;
  imageUrl?: string;
  prompt?: string | null;
  lang?: string;
}

/** Contexte d'analyse fourni à /api/chat pour répondre à une question de suivi. */
export interface ChatContext {
  description: string;
  visualization: Visualization;
  model: string;
  lang?: string;
  processingTime?: number;
  requestId?: string;
}
