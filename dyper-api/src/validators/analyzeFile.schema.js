// Schéma de validation Zod pour la route POST /analyze (upload de fichier).
'use strict'

const { z } = require('zod')

/**
 * Schéma Zod pour le corps de la requête d'analyse d'un fichier uploadé.
 * Le fichier lui-même est géré par Multer — ce schéma valide uniquement les champs textuels.
 *
 * @property {string} [prompt] - Instruction ou question associée à l'analyse (max 1000 caractères).
 * @property {string} [lang]   - Langue de la réponse (défaut : "fr").
 */
const analyzeFileSchema = z.object({
  prompt: z
    .string()
    .max(1000, 'Le prompt ne peut pas dépasser 1000 caractères.')
    .optional(),

  lang: z
    .string()
    .optional()
    .default('fr'),
})

module.exports = { analyzeFileSchema }
