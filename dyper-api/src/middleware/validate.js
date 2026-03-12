// Factory de middleware de validation — prend un schéma Zod et valide le corps de la requête entrante.
'use strict'

const { ValidationError } = require('../utils/errors')

/**
 * Crée un middleware Express qui valide `req.body` contre un schéma Zod.
 * En cas d'échec, passe une ValidationError normalisée au gestionnaire d'erreurs.
 *
 * @param {import('zod').ZodSchema} schema - Le schéma Zod à utiliser pour la validation.
 * @returns {Function} Middleware Express (req, res, next).
 */
function validate(schema) {
  return (req, res, next) => {
    // Analyse le corps de la requête avec le schéma fourni.
    const result = schema.safeParse(req.body)

    if (!result.success) {
      // Extrait les erreurs Zod pour les inclure dans les détails.
      const issues = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))

      return next(new ValidationError(
        'Les données fournies sont invalides.',
        { issues },
      ))
    }

    // Remplace req.body par les données validées et transformées par Zod.
    req.body = result.data
    return next()
  }
}

module.exports = { validate }
