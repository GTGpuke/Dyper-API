// Service de chat LLM — utilise Groq (Llama 3.1) pour répondre aux questions sur un résultat d'analyse.
import Groq from 'groq-sdk';
import type { Stream } from 'groq-sdk/lib/streaming';
import type { ChatCompletionChunk } from 'groq-sdk/resources/chat/completions';
import type { ChatContext } from '../../types';
import { ChatNotConfiguredError, ChatProcessingError } from '../../utils/errors';
import { env } from '../env.service';
import logger from '../logger.service';

// Modèle multimodal : répond aux questions en VOYANT l'image (miniature jointe au message).
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

// Contenu d'un message utilisateur : texte seul, ou texte + image (data-URL base64).
type UserContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

// Construit le contenu du message utilisateur (multimodal si une miniature est fournie).
function buildUserContent(question: string, imageBase64?: string | null): UserContent {
  if (!imageBase64) return question;
  return [
    { type: 'text', text: question },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
  ];
}

class GroqService {
  private client: Groq | null = null;

  /** Lève ChatNotConfiguredError si la clé Groq est absente (à appeler AVANT d'ouvrir un flux SSE). */
  assertConfigured(): void {
    if (!env.GROQ_API_KEY) {
      throw new ChatNotConfiguredError();
    }
  }

  // Instancie le client Groq à la demande (et échoue clairement si la clé est absente).
  private getClient(): Groq {
    this.assertConfigured();
    if (!this.client) {
      this.client = new Groq({ apiKey: env.GROQ_API_KEY });
    }
    return this.client;
  }

  // Construit le prompt système décrivant le résultat d'analyse à l'assistant.
  private buildSystemPrompt(context: ChatContext, lang: string): string {
    const { description, visualization } = context;
    const { scene, objects, colors, tags } = visualization;

    // Objets numérotés avec position : permet de référencer « l'objet #2 » ou « celui de gauche ».
    const objectsText =
      objects.length > 0
        ? objects
            .map((o, i) => {
              const box = o.boundingBox
                ? ` — boîte [x:${Math.round(o.boundingBox.x)}, y:${Math.round(o.boundingBox.y)}, l:${Math.round(o.boundingBox.w)}, h:${Math.round(o.boundingBox.h)}]`
                : '';
              return `#${i + 1} ${o.label} (${Math.round(o.confidence * 100)}%)${box}`;
            })
            .join(' ; ')
        : 'Aucun objet détecté';

    const indoorLabel =
      scene.indoor === true ? 'intérieur' : scene.indoor === false ? 'extérieur' : 'indéterminé';

    const responseLang = lang === 'en' ? 'anglais' : 'français';

    // Chronologie d'apparition des objets (vidéos uniquement).
    const timelineText =
      context.timeline && context.timeline.length > 0
        ? `\n\n**Chronologie (vidéo) :**\n${context.timeline
            .map((e) => `- t=${e.t}s : ${e.labels.join(', ') || 'aucun objet'}`)
            .join('\n')}`
        : '';

    // Transcription de la piste audio (vidéos uniquement).
    const transcriptText = context.audioTranscript
      ? `\n\n**Transcription audio :** « ${context.audioTranscript} »`
      : '';

    // Bande-son identifiée par fingerprinting (vidéos uniquement).
    const musicText = context.music
      ? `\n\n**Musique identifiée :** ${context.music.artist} — ${context.music.title}${
          context.music.album ? ` (album : ${context.music.album})` : ''
        }`
      : '';

    // Chapitres alignés vision/audio (vidéos uniquement) : permet de répondre précisément
    // à « que se passe-t-il à tel moment ? ».
    const formatTime = (s: number) =>
      `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
    const chaptersText =
      context.chapters && context.chapters.length > 0
        ? `\n\n**Chapitres (vidéo) :**\n${context.chapters
            .map((c) => {
              const head = `- [${formatTime(c.tStart)}–${formatTime(c.tEnd)}]`;
              const desc = c.description ?? 'sans description';
              const elements =
                c.elements.length > 0 ? ` (éléments : ${c.elements.join(', ')})` : '';
              const transcript = c.transcript ? ` — « ${c.transcript} »` : '';
              return `${head} ${desc}${elements}${transcript}`;
            })
            .join('\n')}`
        : '';

    return `Tu es un assistant expert en analyse d'images. Une image a été analysée par le système Dyper (basé sur YOLO). Lorsque l'image est jointe au message, fonde tes réponses en priorité sur ce que tu VOIS réellement. Voici les résultats obtenus :

**Description :** ${description}

**Scène détectée :** ${scene.label} (confiance : ${Math.round(scene.confidence * 100)}%, ${indoorLabel})

**Objets détectés :** ${objectsText}

**Couleurs dominantes :** ${colors.join(', ') || 'Non disponibles'}

**Tags :** ${tags.join(', ') || 'Aucun'}${timelineText}${transcriptText}${musicText}${chaptersText}

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
    /** Miniature de l'analyse (base64 JPEG) : le modèle répond en voyant l'image. */
    imageBase64?: string | null;
  }): Promise<{ answer: string; model: string }> {
    const { question, context, lang = 'fr', imageBase64 } = params;
    const client = this.getClient();

    logger.info('Appel vers Groq pour le chat.', { lang, vision: Boolean(imageBase64) });

    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          { role: 'system' as const, content: this.buildSystemPrompt(context, lang) },
          { role: 'user' as const, content: buildUserContent(question, imageBase64) },
        ],
      });
      return { answer: completion.choices[0]?.message?.content ?? '', model: MODEL };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Erreur lors du chat Groq.', { error: msg });
      throw new ChatProcessingError(undefined, { reason: msg });
    }
  }

  /**
   * Ouvre un flux de complétion Groq (token par token) pour le streaming SSE.
   * Le flux retourné est async-itérable et expose `controller` pour l'abandon côté client.
   * @throws {ChatNotConfiguredError} Si GROQ_API_KEY n'est pas configurée.
   * @throws {ChatProcessingError} Si l'ouverture du flux échoue.
   */
  async streamChatWithResult(params: {
    question: string;
    context: ChatContext;
    lang?: string;
    /** Miniature de l'analyse (base64 JPEG) : le modèle répond en voyant l'image. */
    imageBase64?: string | null;
  }): Promise<{ stream: Stream<ChatCompletionChunk>; model: string }> {
    const { question, context, lang = 'fr', imageBase64 } = params;
    const client = this.getClient();

    logger.info('Ouverture du flux de chat Groq.', { lang, vision: Boolean(imageBase64) });

    try {
      const stream = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        stream: true,
        messages: [
          { role: 'system' as const, content: this.buildSystemPrompt(context, lang) },
          { role: 'user' as const, content: buildUserContent(question, imageBase64) },
        ],
      });
      return { stream, model: MODEL };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("Erreur à l'ouverture du flux Groq.", { error: msg });
      throw new ChatProcessingError(undefined, { reason: msg });
    }
  }
}

export default new GroqService();
