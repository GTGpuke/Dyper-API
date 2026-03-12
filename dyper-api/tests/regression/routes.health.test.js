// Tests de régression pour la route GET /health — vérifie la réponse et la détection de l'état de dyper-ai.
'use strict'

const request = require('supertest')

// ─── Mock de la configuration avant le chargement de l'app ───────────────────
jest.mock('../../../src/config', () => ({
  port: 3000,
  aiServiceUrl: 'http://localhost:8000',
  aiInternalKey: 'test-key',
  allowedOrigins: ['http://localhost:5173'],
  maxFileSizeMb: 10,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'],
  requestTimeoutMs: 5000,
}))

// ─── Mock d'axios pour contrôler la disponibilité simulée de dyper-ai ─────────
jest.mock('axios')
const axios = require('axios')

const app = require('../../../src/app')

describe('GET /health', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retourne 200 avec status "ok" et uptime', async () => {
    // Arrange : dyper-ai est disponible.
    axios.get.mockResolvedValue({ data: { status: 'ok' } })

    // Act.
    const res = await request(app).get('/health')

    // Assert.
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(typeof res.body.uptime).toBe('number')
    expect(res.body.uptime).toBeGreaterThanOrEqual(0)
  })

  it('retourne ai: "ok" quand dyper-ai est joignable', async () => {
    // Arrange.
    axios.get.mockResolvedValue({ data: { status: 'ok' } })

    // Act.
    const res = await request(app).get('/health')

    // Assert.
    expect(res.body.ai).toBe('ok')
  })

  it('retourne ai: "unreachable" quand dyper-ai est injoignable', async () => {
    // Arrange : simulation d'une erreur réseau.
    axios.get.mockRejectedValue(new Error('connect ECONNREFUSED'))

    // Act.
    const res = await request(app).get('/health')

    // Assert : le health check ne doit jamais échouer, même si l'IA est down.
    expect(res.status).toBe(200)
    expect(res.body.ai).toBe('unreachable')
  })
})
