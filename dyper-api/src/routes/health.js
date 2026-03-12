// Route de santé — vérifie l'état du serveur dyper-api et la disponibilité de dyper-ai.
'use strict'

const express = require('express')
const axios = require('axios')
const config = require('../config')
const logger = require('../utils/logger')

const router = express.Router()

// ─── GET /health ──────────────────────────────────────────────────────────────

/**
 * Contrôleur de vérification de santé.
 * Retourne l'état courant de dyper-api et tente de joindre dyper-ai.
 * Ne propage jamais d'erreur — retourne toujours une réponse 200 avec l'état réel.
 *
 * @param {object} req - Requête Express.
 * @param {object} res - Réponse Express.
 */
async function healthCheck(req, res) {
  // Statut initial du service IA : inconnu jusqu'à la vérification.
  let aiStatus = 'unreachable'

  try {
    // Tentative de contact avec l'endpoint de santé de dyper-ai.
    await axios.get(`${config.aiServiceUrl}/health`, {
      timeout: 5000,
      headers: { 'X-Internal-Key': config.aiInternalKey },
    })
    aiStatus = 'ok'
  } catch (err) {
    // dyper-ai est injoignable ou a retourné une erreur — on log sans propager.
    logger.warn('dyper-ai injoignable lors du health check.', { error: err.message })
  }

  logger.info('Health check effectué.', { ai: aiStatus })

  return res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    ai: aiStatus,
  })
}

// Enregistrement de la route GET /.
router.get('/', healthCheck)

module.exports = router
