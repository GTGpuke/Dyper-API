// Routes d'analyse — expose les trois modes d'analyse : fichier uploadé, URL et prompt textuel.
'use strict'

const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { uploadMiddleware } = require('../middleware/upload')
const { validate } = require('../middleware/validate')
const { analyzeFileSchema } = require('../validators/analyzeFile.schema')
const { analyzeUrlSchema } = require('../validators/analyzeUrl.schema')
const { analyzePromptSchema } = require('../validators/analyzePrompt.schema')
const { processWithAI } = require('../services/aiService')
const { AppError } = require('../utils/errors')
const logger = require('../utils/logger')

const router = express.Router()

// ─── POST /analyze — Analyse d'un fichier uploadé ────────────────────────────

/**
 * Contrôleur d'analyse par upload de fichier.
 * Accepte un fichier multipart/form-data, l'encode en base64 et le transmet à dyper-ai.
 *
 * @param {object}   req  - Requête Express enrichie par Multer (req.file).
 * @param {object}   res  - Réponse Express.
 * @param {Function} next - Passage au gestionnaire d'erreurs.
 */
async function analyzeFile(req, res, next) {
  try {
    // Vérifie qu'un fichier a bien été fourni dans la requête.
    if (!req.file) {
      return next(new AppError(
        'Aucun fichier fourni. Le champ "file" est requis.',
        'VALIDATION_ERROR',
        400,
      ))
    }

    const requestId = uuidv4()
    const startTime = Date.now()

    logger.info('Analyse de fichier démarrée.', { requestId, mimetype: req.file.mimetype })

    // Appel au service IA avec le buffer du fichier.
    const aiResponse = await processWithAI({
      requestId,
      fileBuffer: req.file.buffer,
      mimetype: req.file.mimetype,
      prompt: req.body.prompt,
      lang: req.body.lang,
    })

    const processingTime = Date.now() - startTime

    logger.info('Analyse de fichier terminée.', { requestId, processingTime })

    return res.status(200).json({
      success: true,
      requestId,
      processingTime,
      result: {
        ...aiResponse,
        lang: req.body.lang || 'fr',
      },
    })
  } catch (err) {
    return next(err)
  }
}

// ─── POST /analyze/url — Analyse depuis une URL ───────────────────────────────

/**
 * Contrôleur d'analyse par URL d'image.
 * Transmet l'URL à dyper-ai qui se charge de récupérer l'image.
 *
 * @param {object}   req  - Requête Express avec body validé par Zod.
 * @param {object}   res  - Réponse Express.
 * @param {Function} next - Passage au gestionnaire d'erreurs.
 */
async function analyzeUrl(req, res, next) {
  try {
    const requestId = uuidv4()
    const startTime = Date.now()

    logger.info('Analyse par URL démarrée.', { requestId, url: req.body.url })

    const aiResponse = await processWithAI({
      requestId,
      imageUrl: req.body.url,
      prompt: req.body.prompt,
      lang: req.body.lang,
    })

    const processingTime = Date.now() - startTime

    logger.info('Analyse par URL terminée.', { requestId, processingTime })

    return res.status(200).json({
      success: true,
      requestId,
      processingTime,
      result: {
        ...aiResponse,
        lang: req.body.lang || 'fr',
      },
    })
  } catch (err) {
    return next(err)
  }
}

// ─── POST /analyze/prompt — Analyse textuelle pure ───────────────────────────

/**
 * Contrôleur d'analyse par prompt textuel uniquement.
 * Aucun média n'est requis — dyper-ai traite la requête comme une instruction pure.
 *
 * @param {object}   req  - Requête Express avec body validé par Zod.
 * @param {object}   res  - Réponse Express.
 * @param {Function} next - Passage au gestionnaire d'erreurs.
 */
async function analyzePrompt(req, res, next) {
  try {
    const requestId = uuidv4()
    const startTime = Date.now()

    logger.info('Analyse par prompt démarrée.', { requestId })

    const aiResponse = await processWithAI({
      requestId,
      prompt: req.body.prompt,
      lang: req.body.lang,
    })

    const processingTime = Date.now() - startTime

    logger.info('Analyse par prompt terminée.', { requestId, processingTime })

    return res.status(200).json({
      success: true,
      requestId,
      processingTime,
      result: {
        ...aiResponse,
        lang: req.body.lang || 'fr',
      },
    })
  } catch (err) {
    return next(err)
  }
}

// ─── Déclaration des routes ────────────────────────────────────────────────────

// Route d'analyse par fichier : upload Multer puis validation du body textuel.
router.post('/', uploadMiddleware, validate(analyzeFileSchema), analyzeFile)

// Route d'analyse par URL : validation du body JSON.
router.post('/url', validate(analyzeUrlSchema), analyzeUrl)

// Route d'analyse par prompt : validation du body JSON.
router.post('/prompt', validate(analyzePromptSchema), analyzePrompt)

module.exports = router
