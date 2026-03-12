// Tests unitaires pour le middleware d'upload Multer — vérifie le filtrage des types MIME et la gestion des erreurs.
'use strict'

const { InvalidFileTypeError, FileTooLargeError } = require('../../../src/utils/errors')

// ─── Mock de la configuration pour contrôler les valeurs dans les tests ───────
jest.mock('../../../src/config', () => ({
  maxFileSizeMb: 10,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'],
}))

// ─── Mock de Multer pour simuler son comportement sans I/O réel ───────────────
jest.mock('multer', () => {
  const multerMock = jest.fn().mockImplementation((options) => ({
    single: jest.fn().mockReturnValue((req, res, cb) => {
      // Simule la validation du type MIME via le fileFilter configuré.
      if (req._testFile) {
        const fakeDone = (err, accept) => {
          if (err) return cb(err)
          if (accept) req.file = req._testFile
          cb()
        }
        options.fileFilter(req, req._testFile, fakeDone)
      } else if (req._simulateLimitError) {
        // Simule une erreur de taille de fichier.
        const err = new Error('File too large')
        err.code = 'LIMIT_FILE_SIZE'
        cb(err)
      } else {
        cb()
      }
    }),
  }))
  multerMock.memoryStorage = jest.fn().mockReturnValue({})
  return multerMock
})

const { uploadMiddleware } = require('../../../src/middleware/upload')

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('uploadMiddleware', () => {
  it('appelle next() sans erreur pour un type MIME autorisé', (done) => {
    // Arrange : simulation d'un fichier JPEG valide.
    const req = { _testFile: { mimetype: 'image/jpeg', buffer: Buffer.from('fake') } }
    const res = {}

    // Act + Assert.
    uploadMiddleware(req, res, (err) => {
      expect(err).toBeUndefined()
      expect(req.file).toBeDefined()
      done()
    })
  })

  it('appelle next(InvalidFileTypeError) pour un type MIME non supporté', (done) => {
    // Arrange : simulation d'un fichier PDF non autorisé.
    const req = { _testFile: { mimetype: 'application/pdf' } }
    const res = {}

    // Act + Assert.
    uploadMiddleware(req, res, (err) => {
      expect(err).toBeInstanceOf(InvalidFileTypeError)
      expect(err.code).toBe('INVALID_FILE_TYPE')
      expect(err.statusCode).toBe(415)
      done()
    })
  })

  it('appelle next(FileTooLargeError) si le fichier dépasse la taille limite', (done) => {
    // Arrange : simulation d'une erreur Multer LIMIT_FILE_SIZE.
    const req = { _simulateLimitError: true }
    const res = {}

    // Act + Assert.
    uploadMiddleware(req, res, (err) => {
      expect(err).toBeInstanceOf(FileTooLargeError)
      expect(err.code).toBe('FILE_TOO_LARGE')
      expect(err.statusCode).toBe(413)
      done()
    })
  })

  it('accepte les types MIME vidéo (video/mp4)', (done) => {
    // Arrange : simulation d'un fichier MP4.
    const req = { _testFile: { mimetype: 'video/mp4', buffer: Buffer.from('fake') } }
    const res = {}

    // Act + Assert.
    uploadMiddleware(req, res, (err) => {
      expect(err).toBeUndefined()
      done()
    })
  })
})
