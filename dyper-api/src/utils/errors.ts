// Hiérarchie d'erreurs métier de la passerelle Dyper.
// Chaque erreur encapsule un code métier, un statut HTTP et des détails optionnels.
// Le gestionnaire d'erreurs global (app.ts) les transforme en réponse JSON standardisée :
// { success: false, requestId, error: { code, message, details } }.

export type ErrorDetails = Record<string, unknown>;

/** Classe de base pour toutes les erreurs applicatives Dyper. */
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: ErrorDetails;

  constructor(message: string, code: string, statusCode = 500, details: ErrorDetails = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/** Fichier trop volumineux (413). */
export class FileTooLargeError extends AppError {
  constructor(details: ErrorDetails = {}) {
    super('Le fichier dépasse la taille maximale autorisée.', 'FILE_TOO_LARGE', 413, details);
  }
}

/** Type MIME de fichier non supporté (415). */
export class InvalidFileTypeError extends AppError {
  constructor(details: ErrorDetails = {}) {
    super("Le type de fichier n'est pas supporté.", 'INVALID_FILE_TYPE', 415, details);
  }
}

/** Corps de requête invalide (400). */
export class ValidationError extends AppError {
  constructor(message = 'Les données fournies sont invalides.', details: ErrorDetails = {}) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/** Service dyper-ai injoignable (503). */
export class AiServiceUnavailableError extends AppError {
  constructor(details: ErrorDetails = {}) {
    super(
      "Le service d'intelligence artificielle est indisponible.",
      'AI_SERVICE_UNAVAILABLE',
      503,
      details
    );
  }
}

/** Erreur de traitement côté dyper-ai (422). */
export class AiProcessingError extends AppError {
  constructor(
    message = 'Erreur lors du traitement par le service IA.',
    details: ErrorDetails = {}
  ) {
    super(message, 'AI_PROCESSING_ERROR', 422, details);
  }
}

/** Délai d'attente dépassé pour le service IA (504). */
export class AiTimeoutError extends AppError {
  constructor(details: ErrorDetails = {}) {
    super(
      "Le service d'intelligence artificielle n'a pas répondu dans les délais.",
      'AI_TIMEOUT',
      504,
      details
    );
  }
}

/** Service de chat non configuré — clé GROQ_API_KEY manquante (503). */
export class ChatNotConfiguredError extends AppError {
  constructor(details: ErrorDetails = {}) {
    super(
      "Le service de chat n'est pas configuré (clé GROQ_API_KEY manquante).",
      'CHAT_NOT_CONFIGURED',
      503,
      details
    );
  }
}

/** Erreur de traitement du chat LLM (502). */
export class ChatProcessingError extends AppError {
  constructor(
    message = 'Erreur lors de la génération de la réponse du chat.',
    details: ErrorDetails = {}
  ) {
    super(message, 'CHAT_PROCESSING_ERROR', 502, details);
  }
}

/** Limite de requêtes atteinte (429). */
export class RateLimitExceededError extends AppError {
  constructor(details: ErrorDetails = {}) {
    super(
      'Trop de requêtes. Veuillez réessayer dans une minute.',
      'RATE_LIMIT_EXCEEDED',
      429,
      details
    );
  }
}

/** Authentification requise ou identifiants invalides (401). */
export class UnauthorizedError extends AppError {
  constructor(
    message = 'Authentification requise ou identifiants invalides.',
    details: ErrorDetails = {}
  ) {
    super(message, 'UNAUTHORIZED', 401, details);
  }
}

/**
 * Quota du forfait atteint (402 Payment Required). Les détails portent le forfait courant et la
 * limite franchie afin que l'interface propose une montée en gamme ciblée.
 */
export class QuotaExceededError extends AppError {
  constructor(message = 'Le quota de votre forfait est atteint.', details: ErrorDetails = {}) {
    super(message, 'QUOTA_EXCEEDED', 402, details);
  }
}

/** Accès refusé — droits insuffisants (403). */
export class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé.', details: ErrorDetails = {}) {
    super(message, 'FORBIDDEN', 403, details);
  }
}

/** Ressource introuvable (404). */
export class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable.', details: ErrorDetails = {}) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

/** Conflit — ressource déjà existante (409). */
export class ConflictError extends AppError {
  constructor(message = 'Cette ressource existe déjà.', details: ErrorDetails = {}) {
    super(message, 'CONFLICT', 409, details);
  }
}

/** Erreur interne non catégorisée (500). */
export class InternalError extends AppError {
  constructor(details: ErrorDetails = {}) {
    super('Une erreur interne est survenue.', 'INTERNAL_ERROR', 500, details);
  }
}

/** Contenu jugé sensible (explicite ou suggestif), refusé à la publication (422). */
export class NsfwContentBlockedError extends AppError {
  constructor(details: ErrorDetails = {}) {
    super(
      'Ce contenu a été jugé sensible et ne peut pas être publié sur le feed public.',
      'NSFW_CONTENT_BLOCKED',
      422,
      details
    );
  }
}

/** Commentaire rejeté par la modération automatique (422). */
export class CommentRejectedError extends AppError {
  constructor(details: ErrorDetails = {}) {
    super(
      'Ce commentaire a été rejeté par la modération automatique.',
      'COMMENT_REJECTED',
      422,
      details
    );
  }
}

/** Modération automatique indisponible — action bloquée par sécurité (503). */
export class ModerationUnavailableError extends AppError {
  constructor(details: ErrorDetails = {}) {
    super(
      'La modération automatique est momentanément indisponible. Veuillez réessayer plus tard.',
      'MODERATION_UNAVAILABLE',
      503,
      details
    );
  }
}
