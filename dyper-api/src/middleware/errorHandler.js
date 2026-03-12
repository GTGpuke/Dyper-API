// Gestionnaire d'erreurs global Express — transforme toutes les erreurs en réponse JSON standardisée.
'use strict'

const { v4: uuidv4 } = require('uuid')
const { AppError } = require('../utils/errors')
const logger = require('../utils/logger')

/**
 * Middleware de gestion des erreurs Express (signature à 4 paramètres obligatoire).
 * Intercepte toutes les erreurs propagées via next(err) et retourne une réponse JSON cohérente.
 *
 * @param {Error}    err  - L'erreur interceptée.
 * @param {object}   req  - Objet requête Express.
 * @param {object}   res  - Objet réponse Express.
 * @param {Function} next - Fonction de passage (non utilisée, mais requise par Express).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Génère un identifiant unique pour tracer l'erreur dans les logs.
  const requestId = req.requestId || uuidv4()

  // Détermine si l'erreur est une AppError connue ou une erreur système inattendue.
  const isAppError = err instanceof AppError

  const statusCode = isAppError ? err.statusCode : 500
  const code = isAppError ? err.code : 'INTERNAL_ERROR'
  const message = isAppError ? err.message : 'Une erreur interne est survenue.'
  const details = isAppError ? (err.details || {}) : {}

  // Journalise l'erreur avec son contexte pour faciliter le débogage.
  const logMeta = { requestId, statusCode, code, path: req.path, method: req.method }
  if (statusCode >= 500) {
    logger.error(`Erreur serveur : ${message}`, { ...logMeta, stack: err.stack })
  } else {
    logger.warn(`Erreur client : ${message}`, logMeta)
  }

  // Retourne la réponse JSON normalisée au client.
  res.status(statusCode).json({
    success: false,
    requestId,
    error: {
      code,
      message,
      details,
    },
  })
}

module.exports = { errorHandler }
