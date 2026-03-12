// Service de communication avec dyper-ai — seule couche autorisée à appeler le service d'inférence.
'use strict'

const axios = require('axios')
const config = require('../config')
const logger = require('../utils/logger')
const {
  AiServiceUnavailableError,
  AiProcessingError,
  AiTimeoutError,
} = require('../utils/errors')

/**
 * Envoie une requête de traitement au service dyper-ai et retourne la réponse normalisée.
 * Gère les erreurs réseau, les timeouts et les erreurs applicatives renvoyées par dyper-ai.
 *
 * @param {object}  options             - Options de traitement.
 * @param {string}  options.requestId   - Identifiant unique de la requête (pour la traçabilité).
 * @param {Buffer}  [options.fileBuffer] - Buffer du fichier uploadé (mode fichier).
 * @param {string}  [options.mimetype]  - Type MIME du fichier (mode fichier).
 * @param {string}  [options.imageUrl]  - URL de l'image à analyser (mode URL).
 * @param {string}  [options.prompt]    - Instruction ou question associée à l'analyse.
 * @param {string}  [options.lang]      - Langue souhaitée pour la réponse.
 * @returns {Promise<object>} Réponse brute du service dyper-ai.
 * @throws {AiServiceUnavailableError} Si dyper-ai est injoignable.
 * @throws {AiTimeoutError}            Si dyper-ai ne répond pas dans les délais.
 * @throws {AiProcessingError}         Si dyper-ai retourne une erreur de traitement.
 */
async function processWithAI({ requestId, fileBuffer, mimetype, imageUrl, prompt, lang }) {
  // Construction du payload JSON conforme au schéma ProcessRequest de dyper-ai.
  const payload = {
    requestId,
    prompt: prompt || null,
    lang: lang || 'fr',
  }

  // Mode fichier : le buffer est encodé en base64 pour le transport JSON.
  // Le type est déduit du MIME : "video/*" → video, tout le reste → image.
  if (fileBuffer) {
    const isVideo = typeof mimetype === 'string' && mimetype.startsWith('video/')
    payload.type = isVideo ? 'video' : 'image'
    if (isVideo) {
      payload.videoBase64 = fileBuffer.toString('base64')
    } else {
      payload.imageBase64 = fileBuffer.toString('base64')
    }
  }
  // Mode URL : l'URL de l'image est transmise directement.
  else if (imageUrl) {
    payload.type = 'image'
    payload.imageUrl = imageUrl
  }
  // Mode prompt : analyse textuelle pure sans média associé.
  else {
    payload.type = 'prompt'
  }

  logger.info('Appel vers dyper-ai en cours.', { requestId, type: payload.type })

  try {
    const response = await axios.post(
      `${config.aiServiceUrl}/process`,
      payload,
      {
        // En-tête d'authentification interne entre les services.
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': config.aiInternalKey,
        },
        // Timeout configurable depuis les variables d'environnement.
        timeout: config.requestTimeoutMs,
      },
    )

    logger.info('Réponse reçue de dyper-ai.', { requestId })
    return response.data

  } catch (err) {
    // Timeout Axios : dyper-ai n'a pas répondu dans les délais impartis.
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      logger.error('Timeout lors de l\'appel à dyper-ai.', { requestId, error: err.message })
      throw new AiTimeoutError({ requestId })
    }

    // Erreur réseau : dyper-ai est injoignable (ECONNREFUSED, ENOTFOUND, etc.).
    if (!err.response) {
      logger.error('Service dyper-ai injoignable.', { requestId, error: err.message })
      throw new AiServiceUnavailableError({ requestId, reason: err.message })
    }

    // Erreur applicative retournée par dyper-ai (4xx ou 5xx).
    const aiMessage = err.response.data?.detail || err.response.data?.message || 'Erreur de traitement IA.'
    logger.error('Erreur de traitement retournée par dyper-ai.', {
      requestId,
      status: err.response.status,
      aiMessage,
    })
    throw new AiProcessingError(aiMessage, {
      requestId,
      aiStatus: err.response.status,
      aiResponse: err.response.data,
    })
  }
}

module.exports = { processWithAI }
