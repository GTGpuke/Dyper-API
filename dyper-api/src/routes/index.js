// Registre central des routes — monte chaque module de route sur son préfixe respectif.
'use strict'

const express = require('express')
const analyzeRouter = require('./analyze')
const healthRouter = require('./health')

const router = express.Router()

// Monte les routes d'analyse sous le préfixe /analyze.
router.use('/analyze', analyzeRouter)

// Monte les routes de santé sous le préfixe /health.
router.use('/health', healthRouter)

module.exports = router
