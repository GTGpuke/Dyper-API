// Service de configuration de l'application.
// Charge les variables d'environnement depuis le fichier .env via dotenv.
// Crash immédiatement au démarrage si une variable requise est manquante,
// afin d'éviter des erreurs silencieuses en cours d'exécution.
import 'dotenv/config';

// Lève une erreur bloquante si la variable est absente ou vide.
function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variable d'environnement requise manquante : ${key}`);
  return value;
}

// Retourne la variable d'environnement ou la valeur par défaut si absente.
function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: Number.parseInt(optional('PORT', '3000'), 10),
  HOST: optional('HOST', '0.0.0.0'),

  // Base de données SQLite — chemin du fichier (« :memory: » en environnement de test).
  DB_STORAGE: optional('DB_STORAGE', './data/dyper.sqlite'),

  // Dossier de stockage des miniatures d'analyses (servies par /api/media).
  MEDIA_DIR: optional('MEDIA_DIR', './data/uploads'),

  LOG_LEVEL: optional('LOG_LEVEL', 'info'),
  LOG_DIR: optional('LOG_DIR', 'logs'),

  // Origines autorisées pour CORS (front dyper-web). Plusieurs origines séparées par des virgules.
  CORS_ORIGIN: required('CORS_ORIGIN')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Clé applicative transmise par le frontend dans le header X-App-Key.
  APP_KEY: required('APP_KEY'),

  // Secret de signature des JWT d'authentification (cookie httpOnly « dyper_token »).
  JWT_SECRET: required('JWT_SECRET'),

  // Service d'inférence dyper-ai.
  AI_SERVICE_URL: required('AI_SERVICE_URL'),
  AI_INTERNAL_KEY: required('AI_INTERNAL_KEY'),
  AI_REQUEST_TIMEOUT_MS: Number.parseInt(optional('AI_REQUEST_TIMEOUT_MS', '30000'), 10),
  // Timeout dédié au traitement vidéo (plus long : analyse de nombreuses images par YOLO).
  AI_VIDEO_TIMEOUT_MS: Number.parseInt(optional('AI_VIDEO_TIMEOUT_MS', '180000'), 10),

  // Upload de fichiers — taille max image, et taille max vidéo (5 min ≫ 10 Mo).
  MAX_FILE_SIZE_MB: Number.parseInt(optional('MAX_FILE_SIZE_MB', '10'), 10),
  MAX_VIDEO_SIZE_MB: Number.parseInt(optional('MAX_VIDEO_SIZE_MB', '100'), 10),

  // Types MIME autorisés pour les uploads (image + vidéo mp4).
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'],

  // Chat LLM (Groq). Optionnel : /api/chat renvoie une erreur claire si absent.
  GROQ_API_KEY: optional('GROQ_API_KEY', ''),

  // Rate limiting.
  RATE_LIMIT_MAX: Number.parseInt(optional('RATE_LIMIT_MAX', '60'), 10),
  RATE_LIMIT_WINDOW: optional('RATE_LIMIT_WINDOW', '1 minute'),

  get isDev() {
    return this.NODE_ENV === 'development';
  },
  get isProd() {
    return this.NODE_ENV === 'production';
  },
  get isTest() {
    return this.NODE_ENV === 'test';
  },
} as const;
