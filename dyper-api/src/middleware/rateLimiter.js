// Middleware de limitation de débit — restreint à 60 requêtes par minute par adresse IP.
'use strict'

const rateLimit = require('express-rate-limit')
const { RateLimitExceededError } = require('../utils/errors')

/**
 * Instance de rate limiter configurée pour 60 requêtes par minute par IP.
 * En cas de dépassement, retourne une AppError normalisée avec le code RATE_LIMIT_EXCEEDED.
 */
const rateLimiter = rateLimit({
  // Fenêtre temporelle d'une minute (en millisecondes).
  windowMs: 60 * 1000,

  // Nombre maximum de requêtes autorisées par fenêtre.
  max: 60,

  // Désactive les en-têtes de limite dépréciés pour n'utiliser que le standard RateLimit.
  standardHeaders: true,
  legacyHeaders: false,

  /**
   * Gestionnaire personnalisé déclenché lorsque la limite est atteinte.
   * Passe une AppError au gestionnaire d'erreurs au lieu de la réponse par défaut.
   *
   * @param {object}   req  - Objet requête Express.
   * @param {object}   _res - Objet réponse Express (non utilisé ici).
   * @param {Function} next - Fonction de passage au middleware d'erreur.
   */
  handler: (req, _res, next) => {
    next(new RateLimitExceededError({ ip: req.ip }))
  },
})

module.exports = { rateLimiter }
