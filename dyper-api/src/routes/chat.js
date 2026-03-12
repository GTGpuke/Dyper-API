// Route POST /chat — reçoit une question + contexte d'analyse et retourne la réponse de Claude Haiku.
'use strict'

const express = require('express')
const { z } = require('zod')
const { chatWithResult } = require('../services/chatService')
const { ValidationError, InternalError } = require('../utils/errors')
const logger = require('../utils/logger')

const router = express.Router()

// Schéma de validation de la requête /chat.
const chatSchema = z.object({
  question: z.string().min(1).max(1000),
  lang: z.string().optional(),
  context: z.object({
    description: z.string(),
    visualization: z.object({
      objects: z.array(z.object({
        label: z.string(),
        confidence: z.number(),
        boundingBox: z.object({
          x: z.number(), y: z.number(), w: z.number(), h: z.number(),
        }).optional(),
      })),
      scene: z.object({
        label: z.string(),
        confidence: z.number(),
        indoor: z.boolean().nullish(),
      }),
      colors: z.array(z.string()),
      text: z.array(z.string()),
      tags: z.array(z.string()),
    }),
    model: z.string(),
    lang: z.string().optional(),
    processingTime: z.number().optional(),
    requestId: z.string().optional(),
  }),
})

router.post('/', async (req, res, next) => {
  const parsed = chatSchema.safeParse(req.body)
  if (!parsed.success) {
    return next(new ValidationError('Paramètres invalides.', parsed.error.flatten()))
  }

  const { question, context, lang } = parsed.data

  try {
    const answer = await chatWithResult({
      question,
      context,
      lang: lang ?? context.lang ?? 'fr',
    })
    return res.json({ success: true, answer })
  } catch (err) {
    logger.error('Erreur lors du chat Claude.', { error: err.message })
    return next(new InternalError({ reason: err.message }))
  }
})

module.exports = router
