// Service de chat LLM — utilise Groq (Llama 3.1) pour répondre aux questions sur un résultat d'analyse.
import Groq from 'groq-sdk';
import type { ChatContext } from '../../types';
import { ChatNotConfiguredError, ChatProcessingError } from '../../utils/errors';
import { env } from '../env.service';
import logger from '../logger.service';

const MODEL = 'llama-3.1-8b-instant';

class GroqService {
  private client: Groq | null = null;

  // Instancie le client Groq à la demande (et échoue clairement si la clé est absente).
  private getClient(): Groq {
    if (!env.GROQ_API_KEY) {
      throw new ChatNotConfiguredError();
    }
    if (!this.client) {
      this.client = new Groq({ apiKey: env.GROQ_API_KEY });
    }
    return this.client;
  }

  // Construit le prompt système décrivant le résultat d'analyse à l'assistant.
  private buildSystemPrompt(context: ChatContext, lang: string): string {
    const { description, visualization } = context;
    const { scene, objects, colors, tags } = visualization;

    const objectsText =
      objects.length > 0
        ? objects.map((o) => `${o.label} (${Math.round(o.confidence * 100)}%)`).join(', ')
        : 'Aucun objet détecté';

    const indoorLabel =
      scene.indoor === true ? 'intérieur' : scene.indoor === false ? 'extérieur' : 'indéterminé';

    const responseLang = lang === 'en' ? 'anglais' : 'français';

    return `Tu es un assistant expert en analyse d'images. Une image a été analysée par le système Dyper (basé sur YOLO). Voici les résultats obtenus :

**Description :** ${description}

**Scène détectée :** ${scene.label} (confiance : ${Math.round(scene.confidence * 100)}%, ${indoorLabel})

**Objets détectés :** ${objectsText}

**Couleurs dominantes :** ${colors.join(', ') || 'Non disponibles'}

**Tags :** ${tags.join(', ') || 'Aucun'}

Réponds de manière concise et naturelle aux questions de l'utilisateur sur cette image et cette analyse. Réponds en ${responseLang}.`;
  }

  /**
   * Envoie une question à Groq avec le contexte d'analyse en prompt système.
   * @throws {ChatNotConfiguredError} Si GROQ_API_KEY n'est pas configurée.
   * @throws {ChatProcessingError} Si l'appel au modèle échoue.
   */
  async chatWithResult(params: {
    question: string;
    context: ChatContext;
    lang?: string;
  }): Promise<{ answer: string; model: string }> {
    const { question, context, lang = 'fr' } = params;
    const client = this.getClient();

    logger.info('Appel vers Groq pour le chat.', { lang });

    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          { role: 'system' as const, content: this.buildSystemPrompt(context, lang) },
          { role: 'user' as const, content: question },
        ],
      });
      return { answer: completion.choices[0]?.message?.content ?? '', model: MODEL };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Erreur lors du chat Groq.', { error: msg });
      throw new ChatProcessingError(undefined, { reason: msg });
    }
  }
}

export default new GroqService();
