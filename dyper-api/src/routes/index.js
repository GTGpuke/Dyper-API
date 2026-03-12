// Registre central des routes — monte chaque module de route sur son préfixe respectif.
'use strict'

const express = require('express')
const analyzeRouter = require('./analyze')
const healthRouter = require('./health')
const chatRouter = require('./chat')

const router = express.Router()

// Monte les routes d'analyse sous le préfixe /analyze.
router.use('/analyze', analyzeRouter)

// Monte les routes de santé sous le préfixe /health.
router.use('/health', healthRouter)

// Monte la route de chat LLM sous le préfixe /chat.
router.use('/chat', chatRouter)

module.exports = router
