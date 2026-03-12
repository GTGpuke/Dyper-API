// Schéma de validation Zod pour la route POST /analyze/prompt (analyse textuelle pure).
'use strict'

const { z } = require('zod')

/**
 * Schéma Zod pour le corps de la requête d'analyse basée sur un prompt textuel uniquement.
 *
 * @property {string}  prompt - Instruction ou question à analyser (requis, max 1000 caractères).
 * @property {string} [lang]  - Langue de la réponse (défaut : "fr").
 */
const analyzePromptSchema = z.object({
  prompt: z
    .string({ required_error: 'Le prompt est requis.' })
    .min(1, 'Le prompt ne peut pas être vide.')
    .max(1000, 'Le prompt ne peut pas dépasser 1000 caractères.'),

  lang: z
    .string()
    .optional()
    .default('fr'),
})

module.exports = { analyzePromptSchema }
