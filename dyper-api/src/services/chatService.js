// Service de chat LLM — utilise Groq (Llama 3) pour répondre aux questions sur un résultat d'analyse.
'use strict'

const Groq = require('groq-sdk')
const config = require('../config')
const logger = require('../utils/logger')

const client = new Groq({ apiKey: config.groqApiKey })

/**
 * Construit le prompt système à partir d'un AnalysisResult.
 *
 * @param {object} context - Résultat d'analyse Dyper.
 * @param {string} lang    - Langue souhaitée pour la réponse.
 * @returns {string}
 */
function buildSystemPrompt(context, lang) {
  const { description, visualization } = context
  const { scene, objects, colors, tags } = visualization

  const objectsText = objects.length > 0
    ? objects.map((o) => `${o.label} (${Math.round(o.confidence * 100)}%)`).join(', ')
    : 'Aucun objet détecté'

  const indoorLabel =
    scene.indoor === true ? 'intérieur' :
    scene.indoor === false ? 'extérieur' :
    'indéterminé'

  const responseLang = lang === 'en' ? 'anglais' : 'français'

  return `Tu es un assistant expert en analyse d'images. Une image a été analysée par le système Dyper (basé sur YOLO). Voici les résultats obtenus :

**Description :** ${description}

**Scène détectée :** ${scene.label} (confiance : ${Math.round(scene.confidence * 100)}%, ${indoorLabel})

**Objets détectés :** ${objectsText}

**Couleurs dominantes :** ${colors.join(', ') || 'Non disponibles'}

**Tags :** ${tags.join(', ') || 'Aucun'}

Réponds de manière concise et naturelle aux questions de l'utilisateur sur cette image et cette analyse. Réponds en ${responseLang}.`
}

/**
 * Envoie une question à Groq (Llama 3) avec le contexte d'analyse en system prompt.
 *
 * @param {object} options
 * @param {string} options.question - Question posée par l'utilisateur.
 * @param {object} options.context  - Résultat d'analyse Dyper (AnalysisResult).
 * @param {string} options.lang     - Langue souhaitée pour la réponse.
 * @returns {Promise<string>} Réponse du modèle.
 */
async function chatWithResult({ question, context, lang = 'fr' }) {
  logger.info('Appel vers Groq pour le chat.', { lang })

  const completion = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: buildSystemPrompt(context, lang) },
      { role: 'user', content: question },
    ],
  })

  return completion.choices[0]?.message?.content ?? ''
}

module.exports = { chatWithResult }
