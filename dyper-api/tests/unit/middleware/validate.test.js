// Tests unitaires pour le middleware de validation Zod — vérifie l'acceptation et le rejet des données.
'use strict'

const { z } = require('zod')
const { validate } = require('../../../src/middleware/validate')
const { ValidationError } = require('../../../src/utils/errors')

// ─── Helpers de test ──────────────────────────────────────────────────────────

/**
 * Crée un mock d'objet requête Express avec le body fourni.
 *
 * @param {object} body - Corps de la requête à simuler.
 * @returns {object} Mock de requête Express.
 */
function mockReq(body) {
  return { body }
}

/** Mock de réponse Express (non utilisé dans validate). */
const mockRes = {}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive().optional(),
  })

  it('appelle next() sans erreur si le body est valide', () => {
    // Arrange.
    const req = mockReq({ name: 'Dyper', age: 3 })
    const next = jest.fn()

    // Act.
    validate(schema)(req, mockRes, next)

    // Assert : next doit être appelé sans argument d'erreur.
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
  })

  it('remplace req.body par les données validées et transformées par Zod', () => {
    // Arrange : schéma avec valeur par défaut.
    const schemaWithDefault = z.object({
      prompt: z.string().optional(),
      lang: z.string().default('fr'),
    })
    const req = mockReq({ prompt: 'test' })
    const next = jest.fn()

    // Act.
    validate(schemaWithDefault)(req, mockRes, next)

    // Assert : la valeur par défaut de lang doit être appliquée.
    expect(req.body.lang).toBe('fr')
    expect(next).toHaveBeenCalledWith()
  })

  it('appelle next(ValidationError) si le body est invalide', () => {
    // Arrange : body manquant le champ requis "name".
    const req = mockReq({ age: 25 })
    const next = jest.fn()

    // Act.
    validate(schema)(req, mockRes, next)

    // Assert : next doit recevoir une ValidationError.
    expect(next).toHaveBeenCalledTimes(1)
    const errorArg = next.mock.calls[0][0]
    expect(errorArg).toBeInstanceOf(ValidationError)
    expect(errorArg.statusCode).toBe(400)
    expect(errorArg.code).toBe('VALIDATION_ERROR')
  })

  it('inclut les détails des erreurs Zod dans les détails de la ValidationError', () => {
    // Arrange.
    const req = mockReq({ age: -5 })
    const next = jest.fn()

    // Act.
    validate(schema)(req, mockRes, next)

    // Assert : les issues doivent contenir les champs en erreur.
    const errorArg = next.mock.calls[0][0]
    expect(errorArg.details).toHaveProperty('issues')
    expect(Array.isArray(errorArg.details.issues)).toBe(true)
    expect(errorArg.details.issues.length).toBeGreaterThan(0)
  })

  it('rejette un body null', () => {
    // Arrange.
    const req = mockReq(null)
    const next = jest.fn()

    // Act.
    validate(schema)(req, mockRes, next)

    // Assert.
    expect(next.mock.calls[0][0]).toBeInstanceOf(ValidationError)
  })
})
