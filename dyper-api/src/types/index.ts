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

/** Présence d'objets à un instant donné d'une vidéo (chronologie d'apparition). */
export interface TimelineEntry {
  t: number;
  labels: string[];
}

/** Réponse brute du service d'inférence dyper-ai (POST /process). */
export interface ProcessAiResponse {
  requestId: string;
  description: string;
  visualization: Visualization;
  model: string;
  processingTimeMs: number;
  // Champs optionnels (contrat rétrocompatible) pour l'expérience conversationnelle.
  thumbnailBase64?: string | null;
  timeline?: TimelineEntry[] | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
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
  /** Chronologie d'apparition des objets (vidéos) — enrichit le prompt système. */
  timeline?: TimelineEntry[] | null;
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

// ─── Conversations ─────────────────────────────────────────────────────────────

/** Rôle d'un message de conversation. */
export type MessageRole = 'user' | 'assistant';

/** Nature d'un message : texte libre ou carte d'analyse. */
export type MessageKind = 'text' | 'analysis';

/** Analyse inlinée dans un message assistant (vue construite pour le client). */
export interface InlineAnalysis {
  id: string;
  requestId: string;
  type: AnalyzeType;
  description: string;
  model: string;
  lang: string;
  sceneLabel: string;
  sceneConfidence: number;
  indoor: boolean | null;
  objects: DetectedObject[];
  colors: string[];
  tags: string[];
  timeline: TimelineEntry[] | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  thumbnailUrl: string | null;
}

/** Vue d'un message renvoyée au client (analyse inlinée si carte). */
export interface MessageView {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  attachmentName: string | null;
  seq: number;
  createdAt: Date;
  analysis: InlineAnalysis | null;
}
