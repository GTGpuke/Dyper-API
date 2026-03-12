// Middleware de gestion des uploads de fichiers via Multer — stockage en mémoire, filtrage par type MIME et taille.
'use strict'

const multer = require('multer')
const config = require('../config')
const { InvalidFileTypeError, FileTooLargeError } = require('../utils/errors')

/**
 * Filtre les fichiers entrants selon les types MIME autorisés.
 * Rejette immédiatement tout fichier dont le type n'est pas supporté.
 *
 * @param {object} _req  - Objet requête Express (non utilisé).
 * @param {object} file  - Fichier Multer en cours de traitement.
 * @param {Function} cb  - Callback Multer (accepter ou rejeter).
 */
function fileFilter(_req, file, cb) {
  if (config.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new InvalidFileTypeError({
      received: file.mimetype,
      allowed: config.allowedMimeTypes,
    }))
  }
}

// Instance Multer configurée avec stockage en mémoire et limites de taille.
const upload = multer({
  // Stockage en mémoire pour éviter d'écrire sur le disque.
  storage: multer.memoryStorage(),

  // Taille maximale du fichier convertie de Mo en octets.
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
  },

  fileFilter,
})

/**
 * Middleware d'upload pour un fichier unique dans le champ "file".
 * Intercepte l'erreur Multer LIMIT_FILE_SIZE et la transforme en AppError lisible.
 *
 * @param {object}   req  - Objet requête Express.
 * @param {object}   res  - Objet réponse Express.
 * @param {Function} next - Fonction de passage au middleware suivant.
 */
function uploadMiddleware(req, res, next) {
  const multerHandler = upload.single('file')

  multerHandler(req, res, (err) => {
    if (!err) {
      return next()
    }

    // Transforme l'erreur de taille Multer en AppError normalisée.
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new FileTooLargeError({ maxMb: config.maxFileSizeMb }))
    }

    // Propage toute autre erreur (y compris InvalidFileTypeError déjà créée).
    return next(err)
  })
}

module.exports = { uploadMiddleware }
