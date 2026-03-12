// Configuration de l'application Express — assemble les middlewares et les routes dans l'ordre correct.
'use strict'

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const morgan = require('morgan')
const config = require('./config')
const routes = require('./routes')
const { rateLimiter } = require('./middleware/rateLimiter')
const { errorHandler } = require('./middleware/errorHandler')

const app = express()

// ─── 1. Sécurité HTTP — helmet ajoute des en-têtes de sécurité standards ────
app.use(helmet())

// ─── 2. CORS — autorise uniquement les origines déclarées dans la config ─────
app.use(cors({
  origin: (origin, callback) => {
    // Permet les requêtes sans origin (outils comme Postman, curl).
    if (!origin || config.allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`Origine non autorisée : ${origin}`))
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// ─── 3. Parsing JSON — limite le corps à 1 Mo pour éviter les abus ───────────
app.use(express.json({ limit: '1mb' }))

// ─── 4. Journalisation HTTP — morgan en format combined pour les logs d'accès ─
app.use(morgan('combined'))

// ─── 5. Limitation de débit — protège contre les abus de l'API ───────────────
app.use(rateLimiter)

// ─── 6. Routes applicatives ───────────────────────────────────────────────────
app.use('/', routes)

// ─── 7. Gestionnaire d'erreurs — doit être déclaré en dernier ────────────────
app.use(errorHandler)

module.exports = app
