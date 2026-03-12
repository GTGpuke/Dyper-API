// Tests de régression pour les routes POST /analyze — vérifie le comportement complet des trois modes d'analyse.
'use strict'

const request = require('supertest')
const path = require('path')

// ─── Mock de la configuration avant tout chargement de module ─────────────────
jest.mock('../../../src/config', () => ({
  port: 3000,
  aiServiceUrl: 'http://localhost:8000',
  aiInternalKey: 'test-key',
  allowedOrigins: ['http://localhost:5173'],
  maxFileSizeMb: 10,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'],
  requestTimeoutMs: 5000,
}))

// ─── Mock de aiService pour éviter les appels réseau réels ───────────────────
jest.mock('../../../src/services/aiService')
const { processWithAI } = require('../../../src/services/aiService')

// ─── Mock du logger pour éviter la pollution des sorties de test ──────────────
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

const app = require('../../../src/app')
const mockAiResponse = require('../fixtures/mock_ai_response.json')

// ─── Tests POST /analyze (upload fichier) ─────────────────────────────────────

describe('POST /analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retourne 200 avec la réponse formatée pour un fichier JPEG valide', async () => {
    // Arrange.
    processWithAI.mockResolvedValue(mockAiResponse)

    // Act : envoi d'un buffer JPEG simulé.
    const res = await request(app)
      .post('/analyze')
      .attach('file', Buffer.from('fake jpeg data'), {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .field('lang', 'fr')

    // Assert.
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.requestId).toBeDefined()
    expect(typeof res.body.processingTime).toBe('number')
    expect(res.body.result).toBeDefined()
    expect(res.body.result.lang).toBe('fr')
  })

  it('retourne 400 si aucun fichier n\'est fourni', async () => {
    // Act.
    const res = await request(app)
      .post('/analyze')
      .send({ lang: 'fr' })

    // Assert.
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('retourne 415 si le type MIME du fichier n\'est pas supporté', async () => {
    // Act : envoi d'un fichier PDF non supporté.
    const res = await request(app)
      .post('/analyze')
      .attach('file', Buffer.from('fake pdf'), {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      })

    // Assert.
    expect(res.status).toBe(415)
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE')
  })

  it('propage l\'erreur IA et retourne le bon statut', async () => {
    // Arrange : simulation d'une erreur de traitement IA.
    const { AiProcessingError } = require('../../../src/utils/errors')
    processWithAI.mockRejectedValue(new AiProcessingError('Image corrompue.'))

    // Act.
    const res = await request(app)
      .post('/analyze')
      .attach('file', Buffer.from('corrupt'), {
        filename: 'bad.jpg',
        contentType: 'image/jpeg',
      })

    // Assert.
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('AI_PROCESSING_ERROR')
  })
})

// ─── Tests POST /analyze/url ──────────────────────────────────────────────────

describe('POST /analyze/url', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retourne 200 avec la réponse formatée pour une URL valide', async () => {
    // Arrange.
    processWithAI.mockResolvedValue(mockAiResponse)

    // Act.
    const res = await request(app)
      .post('/analyze/url')
      .send({ url: 'https://example.com/image.jpg', lang: 'fr' })

    // Assert.
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.requestId).toBeDefined()
    expect(res.body.result.lang).toBe('fr')
  })

  it('retourne 400 si l\'URL est manquante', async () => {
    // Act.
    const res = await request(app)
      .post('/analyze/url')
      .send({ lang: 'fr' })

    // Assert.
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('retourne 400 si l\'URL est invalide', async () => {
    // Act.
    const res = await request(app)
      .post('/analyze/url')
      .send({ url: 'pas-une-url', lang: 'fr' })

    // Assert.
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── Tests POST /analyze/prompt ───────────────────────────────────────────────

describe('POST /analyze/prompt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retourne 200 avec la réponse formatée pour un prompt valide', async () => {
    // Arrange.
    processWithAI.mockResolvedValue(mockAiResponse)

    // Act.
    const res = await request(app)
      .post('/analyze/prompt')
      .send({ prompt: 'Qu\'est-ce qu\'un chien ?', lang: 'fr' })

    // Assert.
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.result.lang).toBe('fr')
  })

  it('retourne 400 si le prompt est manquant', async () => {
    // Act.
    const res = await request(app)
      .post('/analyze/prompt')
      .send({ lang: 'fr' })

    // Assert.
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('retourne 400 si le prompt dépasse 1000 caractères', async () => {
    // Arrange : génère un prompt trop long.
    const longPrompt = 'a'.repeat(1001)

    // Act.
    const res = await request(app)
      .post('/analyze/prompt')
      .send({ prompt: longPrompt, lang: 'fr' })

    // Assert.
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('retourne le requestId dans chaque réponse réussie', async () => {
    // Arrange.
    processWithAI.mockResolvedValue(mockAiResponse)

    // Act.
    const res1 = await request(app)
      .post('/analyze/prompt')
      .send({ prompt: 'Test 1.', lang: 'fr' })

    const res2 = await request(app)
      .post('/analyze/prompt')
      .send({ prompt: 'Test 2.', lang: 'fr' })

    // Assert : chaque requête doit avoir un requestId unique.
    expect(res1.body.requestId).toBeDefined()
    expect(res2.body.requestId).toBeDefined()
    expect(res1.body.requestId).not.toBe(res2.body.requestId)
  })
})
