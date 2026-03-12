// Tests unitaires pour l'utilitaire fileToBase64 — vérifie la conversion correcte de Buffer en base64.
'use strict'

const { fileToBase64 } = require('../../../src/utils/fileToBase64')

describe('fileToBase64', () => {
  it('convertit un Buffer en chaîne base64 valide', () => {
    // Arrange : buffer contenant du texte ASCII simple.
    const buffer = Buffer.from('Hello Dyper')

    // Act.
    const result = fileToBase64(buffer)

    // Assert : la chaîne base64 décodée doit correspondre à l'original.
    expect(result).toBe(buffer.toString('base64'))
    expect(Buffer.from(result, 'base64').toString('utf8')).toBe('Hello Dyper')
  })

  it('retourne une chaîne vide pour un Buffer vide', () => {
    // Arrange.
    const buffer = Buffer.alloc(0)

    // Act.
    const result = fileToBase64(buffer)

    // Assert.
    expect(result).toBe('')
  })

  it('encode correctement des données binaires (octets arbitraires)', () => {
    // Arrange : buffer avec des octets non-ASCII.
    const buffer = Buffer.from([0x00, 0xFF, 0xAB, 0xCD, 0x12])

    // Act.
    const result = fileToBase64(buffer)

    // Assert : le résultat doit être une chaîne base64 valide.
    expect(typeof result).toBe('string')
    expect(Buffer.from(result, 'base64')).toEqual(buffer)
  })

  it('lève une TypeError si l\'argument n\'est pas un Buffer', () => {
    // Assert : chaque appel avec un type invalide doit lever une TypeError.
    expect(() => fileToBase64('une string')).toThrow(TypeError)
    expect(() => fileToBase64(12345)).toThrow(TypeError)
    expect(() => fileToBase64(null)).toThrow(TypeError)
    expect(() => fileToBase64(undefined)).toThrow(TypeError)
    expect(() => fileToBase64({})).toThrow(TypeError)
  })

  it('lève une TypeError avec le bon message', () => {
    // Assert : le message d'erreur doit être explicite.
    expect(() => fileToBase64('invalide')).toThrow('L\'argument doit être un Buffer valide.')
  })
})
