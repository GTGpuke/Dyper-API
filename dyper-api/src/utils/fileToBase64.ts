// Utilitaire de conversion d'un Buffer en chaîne encodée en base64.
// Utilisé pour transmettre les fichiers uploadés au service dyper-ai via JSON.

/**
 * Convertit un Buffer Node.js en chaîne base64.
 *
 * @throws {TypeError} Si l'argument fourni n'est pas un Buffer valide.
 */
export function fileToBase64(buffer: Buffer): string {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError("L'argument doit être un Buffer valide.");
  }
  return buffer.toString('base64');
}
