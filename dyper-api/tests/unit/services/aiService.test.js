// Tests unitaires pour aiService — vérifie la construction des payloads et la gestion des erreurs axios.
'use strict'

const {
  AiServiceUnavailableError,
  AiProcessingError,
  AiTimeoutError,
} = require('../../../src/utils/errors')

// ─── Mock de la configuration ─────────────────────────────────────────────────
jest.mock('../../../src/config', () => ({
  aiServiceUrl: 'http://localhost:8000',
  aiInternalKey: 'test-key',
  requestTimeoutMs: 5000,
}))

// ─── Mock d'axios pour simuler les appels réseau ──────────────────────────────
jest.mock('axios')
const axios = require('axios')

// ─── Mock du logger pour éviter les sorties console dans les tests ────────────
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

const { processWithAI } = require('../../../src/services/aiService')
const mockResponse = require('../../fixtures/mock_ai_response.json')

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('processWithAI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retourne la réponse de dyper-ai pour un fichier valide', async () => {
    // Arrange : axios retourne la réponse mock.
    axios.post.mockResolvedValue({ data: mockResponse })

    const buffer = Buffer.from('fake image data')

    // Act.
    const result = await processWithAI({
      requestId: 'test-id-001',
      fileBuffer: buffer,
      mimetype: 'image/jpeg',
      lang: 'fr',
    })

    // Assert : la réponse doit correspondre au mock.
    expect(result).toEqual(mockResponse)

    // Vérifie que le payload envoyé contient les bonnes propriétés.
    const [url, payload, options] = axios.post.mock.calls[0]
    expect(url).toBe('http://localhost:8000/process')
    expect(payload.type).toBe('file')
    expect(payload.file_data).toBe(buffer.toString('base64'))
    expect(payload.mimetype).toBe('image/jpeg')
    expect(options.headers['X-Internal-Key']).toBe('test-key')
    expect(options.timeout).toBe(5000)
  })

  it('construit le payload de type "url" pour une analyse par URL', async () => {
    // Arrange.
    axios.post.mockResolvedValue({ data: mockResponse })

    // Act.
    await processWithAI({
      requestId: 'test-id-002',
      imageUrl: 'https://example.com/image.jpg',
      prompt: 'Décris cette image.',
      lang: 'fr',
    })

    // Assert : le type doit être "url" et l'URL doit être transmise.
    const payload = axios.post.mock.calls[0][1]
    expect(payload.type).toBe('url')
    expect(payload.image_url).toBe('https://example.com/image.jpg')
    expect(payload.prompt).toBe('Décris cette image.')
  })

  it('construit le payload de type "prompt" sans média', async () => {
    // Arrange.
    axios.post.mockResolvedValue({ data: mockResponse })

    // Act.
    await processWithAI({
      requestId: 'test-id-003',
      prompt: 'Qu\'est-ce qu\'un chat ?',
      lang: 'fr',
    })

    // Assert.
    const payload = axios.post.mock.calls[0][1]
    expect(payload.type).toBe('prompt')
    expect(payload.prompt).toBe('Qu\'est-ce qu\'un chat ?')
  })

  it('lève AiServiceUnavailableError si axios ne reçoit pas de réponse', async () => {
    // Arrange : simule une erreur réseau sans réponse (ECONNREFUSED).
    const networkError = new Error('connect ECONNREFUSED 127.0.0.1:8000')
    networkError.response = undefined
    axios.post.mockRejectedValue(networkError)

    // Act + Assert.
    await expect(processWithAI({ requestId: 'test-id-004', prompt: 'test' }))
      .rejects.toBeInstanceOf(AiServiceUnavailableError)
  })

  it('lève AiTimeoutError si axios retourne une erreur de timeout', async () => {
    // Arrange : simule un timeout Axios.
    const timeoutError = new Error('timeout of 5000ms exceeded')
    timeoutError.code = 'ECONNABORTED'
    axios.post.mockRejectedValue(timeoutError)

    // Act + Assert.
    await expect(processWithAI({ requestId: 'test-id-005', prompt: 'test' }))
      .rejects.toBeInstanceOf(AiTimeoutError)
  })

  it('lève AiProcessingError si dyper-ai retourne une erreur HTTP', async () => {
    // Arrange : simule une réponse d'erreur HTTP 422 de dyper-ai.
    const httpError = new Error('Request failed with status code 422')
    httpError.response = {
      status: 422,
      data: { detail: 'Image non analysable.' },
    }
    axios.post.mockRejectedValue(httpError)

    // Act + Assert.
    await expect(processWithAI({ requestId: 'test-id-006', prompt: 'test' }))
      .rejects.toBeInstanceOf(AiProcessingError)
  })

  it('inclut le requestId dans le payload envoyé à dyper-ai', async () => {
    // Arrange.
    axios.post.mockResolvedValue({ data: mockResponse })

    // Act.
    await processWithAI({ requestId: 'my-unique-id', prompt: 'test', lang: 'en' })

    // Assert.
    const payload = axios.post.mock.calls[0][1]
    expect(payload.request_id).toBe('my-unique-id')
    expect(payload.lang).toBe('en')
  })
})
