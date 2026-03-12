// Tests unitaires pour les classes d'erreurs custom — vérifie les codes, statuts et propriétés.
'use strict'

const {
  AppError,
  FileTooLargeError,
  InvalidFileTypeError,
  ValidationError,
  AiServiceUnavailableError,
  AiProcessingError,
  InternalError,
  RateLimitExceededError,
  AiTimeoutError,
} = require('../../../src/utils/errors')

describe('AppError', () => {
  it('crée une erreur avec les propriétés correctes', () => {
    // Arrange + Act.
    const err = new AppError('Message test.', 'TEST_CODE', 418, { detail: 'info' })

    // Assert.
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AppError)
    expect(err.message).toBe('Message test.')
    expect(err.code).toBe('TEST_CODE')
    expect(err.statusCode).toBe(418)
    expect(err.details).toEqual({ detail: 'info' })
    expect(err.name).toBe('AppError')
  })

  it('utilise statusCode 500 par défaut', () => {
    // Act.
    const err = new AppError('Erreur.', 'CODE')

    // Assert.
    expect(err.statusCode).toBe(500)
  })

  it('utilise un objet vide pour details par défaut', () => {
    // Act.
    const err = new AppError('Erreur.', 'CODE', 400)

    // Assert.
    expect(err.details).toEqual({})
  })
})

describe('FileTooLargeError', () => {
  it('a le code FILE_TOO_LARGE et le statut 413', () => {
    const err = new FileTooLargeError({ maxMb: 10 })
    expect(err.code).toBe('FILE_TOO_LARGE')
    expect(err.statusCode).toBe(413)
    expect(err.details).toEqual({ maxMb: 10 })
  })
})

describe('InvalidFileTypeError', () => {
  it('a le code INVALID_FILE_TYPE et le statut 415', () => {
    const err = new InvalidFileTypeError()
    expect(err.code).toBe('INVALID_FILE_TYPE')
    expect(err.statusCode).toBe(415)
  })
})

describe('ValidationError', () => {
  it('a le code VALIDATION_ERROR et le statut 400', () => {
    const err = new ValidationError('Données invalides.', { issues: [] })
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.statusCode).toBe(400)
    expect(err.details).toEqual({ issues: [] })
  })

  it('utilise un message par défaut si non fourni', () => {
    const err = new ValidationError()
    expect(err.message).toBe('Les données fournies sont invalides.')
  })
})

describe('AiServiceUnavailableError', () => {
  it('a le code AI_SERVICE_UNAVAILABLE et le statut 503', () => {
    const err = new AiServiceUnavailableError()
    expect(err.code).toBe('AI_SERVICE_UNAVAILABLE')
    expect(err.statusCode).toBe(503)
  })
})

describe('AiProcessingError', () => {
  it('a le code AI_PROCESSING_ERROR et le statut 422', () => {
    const err = new AiProcessingError('Erreur de traitement.', { aiStatus: 500 })
    expect(err.code).toBe('AI_PROCESSING_ERROR')
    expect(err.statusCode).toBe(422)
    expect(err.details).toEqual({ aiStatus: 500 })
  })
})

describe('InternalError', () => {
  it('a le code INTERNAL_ERROR et le statut 500', () => {
    const err = new InternalError()
    expect(err.code).toBe('INTERNAL_ERROR')
    expect(err.statusCode).toBe(500)
  })
})

describe('RateLimitExceededError', () => {
  it('a le code RATE_LIMIT_EXCEEDED et le statut 429', () => {
    const err = new RateLimitExceededError()
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(err.statusCode).toBe(429)
  })
})

describe('AiTimeoutError', () => {
  it('a le code AI_TIMEOUT et le statut 504', () => {
    const err = new AiTimeoutError()
    expect(err.code).toBe('AI_TIMEOUT')
    expect(err.statusCode).toBe(504)
  })
})
