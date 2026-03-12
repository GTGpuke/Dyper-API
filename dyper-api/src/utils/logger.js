// Module de journalisation structurée — fournit un wrapper autour de la console avec horodatage ISO.
'use strict'

/**
 * Formate et retourne un objet de log structuré.
 *
 * @param {string} level   - Niveau de log (info, warn, error).
 * @param {string} message - Message principal du log.
 * @param {object} [meta]  - Métadonnées complémentaires optionnelles.
 * @returns {object} Entrée de log structurée avec timestamp.
 */
function formatLogEntry(level, message, meta = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  }
}

/**
 * Journalise un message de niveau informationnel.
 *
 * @param {string} message - Message à journaliser.
 * @param {object} [meta]  - Métadonnées optionnelles.
 */
function info(message, meta = {}) {
  console.log(JSON.stringify(formatLogEntry('info', message, meta)))
}

/**
 * Journalise un message d'avertissement.
 *
 * @param {string} message - Message à journaliser.
 * @param {object} [meta]  - Métadonnées optionnelles.
 */
function warn(message, meta = {}) {
  console.warn(JSON.stringify(formatLogEntry('warn', message, meta)))
}

/**
 * Journalise un message d'erreur.
 *
 * @param {string} message          - Message à journaliser.
 * @param {Error|object} [errorOrMeta] - Erreur ou métadonnées optionnelles.
 */
function error(message, errorOrMeta = {}) {
  // Extrait la stack trace si un objet Error est passé.
  const meta = errorOrMeta instanceof Error
    ? { stack: errorOrMeta.stack, errorMessage: errorOrMeta.message }
    : errorOrMeta

  console.error(JSON.stringify(formatLogEntry('error', message, meta)))
}

module.exports = { info, warn, error }
