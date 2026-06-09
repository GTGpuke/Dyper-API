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

// ─── Préférences utilisateur (colonne JSON `settings` du modèle User) ──────────

/** Apparence de l'interface. */
export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  density: 'comfortable' | 'compact';
}

/** Préférences appliquées aux nouvelles analyses. */
export interface AnalysisSettings {
  defaultLang: string;
  defaultType: 'file' | 'url' | 'prompt';
}

/** Forme complète des préférences utilisateur. */
export interface UserSettings {
  appearance: AppearanceSettings;
  analysis: AnalysisSettings;
}

/** Valeurs par défaut appliquées à la création et à la lecture (forward-compatible). */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  appearance: { theme: 'system', density: 'comfortable' },
  analysis: { defaultLang: 'fr', defaultType: 'file' },
};

/** Identité de l'utilisateur authentifié, attachée à la requête par verifyAuth. */
export interface AuthUser {
  id: string;
  email: string;
}
