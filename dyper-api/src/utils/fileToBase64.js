// Utilitaire de conversion d'un Buffer en chaîne encodée en base64.
'use strict'

/**
 * Convertit un Buffer Node.js en chaîne base64.
 * Utilisé pour transmettre les fichiers uploadés au service dyper-ai via JSON.
 *
 * @param {Buffer} buffer - Le buffer binaire du fichier à encoder.
 * @returns {string} La représentation base64 du buffer.
 * @throws {TypeError} Si l'argument fourni n'est pas un Buffer valide.
 */
function fileToBase64(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('L\'argument doit être un Buffer valide.')
  }

  return buffer.toString('base64')
}

module.exports = { fileToBase64 }
