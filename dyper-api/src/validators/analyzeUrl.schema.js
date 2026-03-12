// Schéma de validation Zod pour la route POST /analyze/url (analyse depuis une URL).
'use strict'

const { z } = require('zod')

/**
 * Schéma Zod pour le corps de la requête d'analyse d'une image via son URL.
 *
 * @property {string}  url    - URL valide de l'image à analyser (requis).
 * @property {string} [prompt] - Instruction ou question associée à l'analyse (max 1000 caractères).
 * @property {string} [lang]   - Langue de la réponse (défaut : "fr").
 */
const analyzeUrlSchema = z.object({
  url: z
    .string({ required_error: 'L\'URL est requise.' })
    .url('L\'URL fournie n\'est pas valide.'),

  prompt: z
    .string()
    .max(1000, 'Le prompt ne peut pas dépasser 1000 caractères.')
    .optional(),

  lang: z
    .string()
    .optional()
    .default('fr'),
})

module.exports = { analyzeUrlSchema }
