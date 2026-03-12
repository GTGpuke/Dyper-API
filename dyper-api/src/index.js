// Point d'entrée de dyper-api — démarre le serveur Express et gère les erreurs critiques du processus.
'use strict'

const app = require('./app')
const config = require('./config')
const logger = require('./utils/logger')

// ─── Démarrage du serveur HTTP ────────────────────────────────────────────────

const server = app.listen(config.port, () => {
  logger.info(`dyper-api démarré et en écoute.`, { port: config.port })
})

// ─── Gestion des erreurs critiques du processus Node.js ──────────────────────

/**
 * Intercepte les promesses rejetées sans handler catch.
 * Journalise l'erreur et ferme le serveur proprement.
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Rejet de promesse non géré détecté — arrêt du serveur.', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  })

  // Ferme le serveur proprement avant de quitter le processus.
  server.close(() => {
    process.exit(1)
  })
})

/**
 * Intercepte les exceptions synchrones non rattrapées.
 * Journalise l'erreur et termine le processus immédiatement.
 */
process.on('uncaughtException', (err) => {
  logger.error('Exception non rattrapée détectée — arrêt immédiat du serveur.', {
    errorMessage: err.message,
    stack: err.stack,
  })

  process.exit(1)
})

module.exports = server
