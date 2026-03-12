// Définition des classes d'erreurs métier personnalisées utilisées dans toute l'application.
'use strict'

/**
 * Classe de base pour toutes les erreurs applicatives Dyper.
 * Encapsule un code métier, un statut HTTP et des détails optionnels.
 */
class AppError extends Error {
  /**
   * @param {string} message   - Message lisible décrivant l'erreur.
   * @param {string} code      - Code métier identifiant le type d'erreur.
   * @param {number} statusCode - Code HTTP à retourner au client.
   * @param {object} details   - Informations complémentaires sur l'erreur.
   */
  constructor(message, code, statusCode = 500, details = {}) {
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.name = 'AppError'

    // Maintient la trace de pile correcte dans Node.js.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }
}

// ─── Codes d'erreurs métier disponibles ───────────────────────────────────────

/** Fichier trop volumineux (413). */
class FileTooLargeError extends AppError {
  constructor(details = {}) {
    super('Le fichier dépasse la taille maximale autorisée.', 'FILE_TOO_LARGE', 413, details)
  }
}

/** Type MIME de fichier non supporté (415). */
class InvalidFileTypeError extends AppError {
  constructor(details = {}) {
    super('Le type de fichier n\'est pas supporté.', 'INVALID_FILE_TYPE', 415, details)
  }
}

/** Corps de requête invalide (400). */
class ValidationError extends AppError {
  constructor(message = 'Les données fournies sont invalides.', details = {}) {
    super(message, 'VALIDATION_ERROR', 400, details)
  }
}

/** Service dyper-ai injoignable (503). */
class AiServiceUnavailableError extends AppError {
  constructor(details = {}) {
    super('Le service d\'intelligence artificielle est indisponible.', 'AI_SERVICE_UNAVAILABLE', 503, details)
  }
}

/** Erreur de traitement côté dyper-ai (422). */
class AiProcessingError extends AppError {
  constructor(message = 'Erreur lors du traitement par le service IA.', details = {}) {
    super(message, 'AI_PROCESSING_ERROR', 422, details)
  }
}

/** Erreur interne non catégorisée (500). */
class InternalError extends AppError {
  constructor(details = {}) {
    super('Une erreur interne est survenue.', 'INTERNAL_ERROR', 500, details)
  }
}

/** Limite de requêtes atteinte (429). */
class RateLimitExceededError extends AppError {
  constructor(details = {}) {
    super('Trop de requêtes. Veuillez réessayer dans une minute.', 'RATE_LIMIT_EXCEEDED', 429, details)
  }
}

/** Délai d'attente dépassé pour le service IA (504). */
class AiTimeoutError extends AppError {
  constructor(details = {}) {
    super('Le service d\'intelligence artificielle n\'a pas répondu dans les délais.', 'AI_TIMEOUT', 504, details)
  }
}

module.exports = {
  AppError,
  FileTooLargeError,
  InvalidFileTypeError,
  ValidationError,
  AiServiceUnavailableError,
  AiProcessingError,
  InternalError,
  RateLimitExceededError,
  AiTimeoutError,
}
