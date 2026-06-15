// Service de chat LLM — utilise Groq (Llama 3.1) pour répondre aux questions sur un résultat d'analyse.
import Groq from 'groq-sdk';
import type { Stream } from 'groq-sdk/lib/streaming';
import type { ChatCompletionChunk } from 'groq-sdk/resources/chat/completions';
import type { ChatContext, DetectedObject, FrameDetections, TimelineEntry } from '../../types';
import { ChatNotConfiguredError, ChatProcessingError } from '../../utils/errors';
import { env } from '../env.service';
import logger from '../logger.service';

// Modèle multimodal : répond aux questions en VOYANT l'image (miniature jointe au message).
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

// Contenu d'un message utilisateur : texte seul, ou texte + image (data-URL base64).
type UserContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

// Tour de conversation antérieur (mémoire du fil transmise au modèle).
export type ChatTurn = { role: 'user' | 'assistant'; content: string };

// Construit le contenu du message utilisateur (multimodal si une miniature est fournie).
function buildUserContent(question: string, imageBase64?: string | null): UserContent {
  if (!imageBase64) return question;
  return [
    { type: 'text', text: question },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
  ];
}

// ─── Mise en forme du contexte pour le prompt (positions relatives, minutage, résumés) ──────────

// Timecode « M:SS » à partir de secondes.
function timecode(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Zone relative du centre d'une boîte dans le cadre, en mots (« en haut à gauche », « au centre »…).
function positionZone(cx: number, cy: number, lang: string): string {
  const en = lang === 'en';
  const h = cx < 0.4 ? (en ? 'left' : 'à gauche') : cx > 0.6 ? (en ? 'right' : 'à droite') : '';
  const v = cy < 0.34 ? (en ? 'top' : 'en haut') : cy > 0.66 ? (en ? 'bottom' : 'en bas') : '';
  return [v, h].filter(Boolean).join(' ') || (en ? 'center' : 'au centre');
}

// Objets d'une image : « #1 chien (95%, au centre) ; … » (position relative si dimensions connues).
function formatImageObjects(
  objects: DetectedObject[],
  width: number | null | undefined,
  height: number | null | undefined,
  lang: string
): string {
  if (objects.length === 0) return lang === 'en' ? 'none' : 'aucun';
  return objects
    .map((o, i) => {
      const pos =
        o.boundingBox && width && height
          ? `, ${positionZone(
              (o.boundingBox.x + o.boundingBox.w / 2) / width,
              (o.boundingBox.y + o.boundingBox.h / 2) / height,
              lang
            )}`
          : '';
      return `#${i + 1} ${o.label} (${Math.round(o.confidence * 100)}%${pos})`;
    })
    .join(' ; ');
}

// Résumé par piste suivie (vidéo) : période d'apparition + position moyenne de chaque objet
// (« chien — de 0:00 à 0:08, au centre »). Apparitions les plus longues d'abord, plafonné.
function summarizeTracks(
  frames: FrameDetections[],
  width: number | null | undefined,
  height: number | null | undefined,
  lang: string,
  max = 15
): string {
  const tracks = new Map<
    number,
    { labels: Map<string, number>; times: number[]; cx: number[]; cy: number[] }
  >();
  for (const frame of frames) {
    for (const o of frame.objects) {
      if (o.trackId == null) continue;
      let tr = tracks.get(o.trackId);
      if (!tr) {
        tr = { labels: new Map(), times: [], cx: [], cy: [] };
        tracks.set(o.trackId, tr);
      }
      tr.labels.set(o.label, (tr.labels.get(o.label) ?? 0) + 1);
      tr.times.push(frame.t);
      if (o.boundingBox && width && height) {
        tr.cx.push((o.boundingBox.x + o.boundingBox.w / 2) / width);
        tr.cy.push((o.boundingBox.y + o.boundingBox.h / 2) / height);
      }
    }
  }
  if (tracks.size === 0) return lang === 'en' ? 'none' : 'aucun';
  const en = lang === 'en';
  const avg = (xs: number[]): number =>
    xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0.5;
  return (
    [...tracks.values()]
      .map((tr) => {
        const label = [...tr.labels.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const t0 = Math.min(...tr.times);
        const t1 = Math.max(...tr.times);
        const zone = tr.cx.length > 0 ? `, ${positionZone(avg(tr.cx), avg(tr.cy), lang)}` : '';
        const span =
          t0 === t1
            ? en
              ? `at ${timecode(t0)}`
              : `à ${timecode(t0)}`
            : en
              ? `from ${timecode(t0)} to ${timecode(t1)}`
              : `de ${timecode(t0)} à ${timecode(t1)}`;
        return { dur: t1 - t0, t0, text: `${label} — ${span}${zone}` };
      })
      // On garde les apparitions les plus longues, puis on les présente dans l'ORDRE CHRONOLOGIQUE
      // (repère temporel fiable pour les questions « à quel moment… »).
      .sort((a, b) => b.dur - a.dur)
      .slice(0, max)
      .sort((a, b) => a.t0 - b.t0)
      .map((l) => `- ${l.text}`)
      .join('\n')
  );
}

// Repli (vidéo sans détections par frame) : périodes d'apparition par label depuis la chronologie.
function summarizeTimeline(timeline: TimelineEntry[], max = 15): string {
  const times = [...new Set(timeline.map((e) => e.t))].sort((a, b) => a - b);
  const step = times.length > 1 ? times[1] - times[0] : 1;
  const byLabel = new Map<string, number[]>();
  for (const e of timeline) {
    for (const l of e.labels) byLabel.set(l, [...(byLabel.get(l) ?? []), e.t]);
  }
  return [...byLabel.entries()]
    .map(([label, ts]) => {
      const sorted = [...new Set(ts)].sort((a, b) => a - b);
      const ranges: Array<[number, number]> = [];
      let start = sorted[0];
      let last = sorted[0];
      for (const t of sorted.slice(1)) {
        if (t - last > step * 1.5) {
          ranges.push([start, last]);
          start = t;
        }
        last = t;
      }
      ranges.push([start, last]);
      const dur = ranges.reduce((s, [a, b]) => s + (b - a), 0);
      const spans = ranges
        .map(([a, b]) => (a === b ? timecode(a) : `${timecode(a)}–${timecode(b)}`))
        .join(', ');
      return { dur, text: `${label} — ${spans}` };
    })
    .sort((a, b) => b.dur - a.dur)
    .slice(0, max)
    .map((l) => `- ${l.text}`)
    .join('\n');
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

  // Construit le prompt système : présente la perception du média à Dyper lui-même (à la première
  // personne), comme une connaissance unifiée — jamais comme les résultats d'un système tiers.
  private buildSystemPrompt(context: ChatContext, lang: string): string {
    const { description, visualization, timeline, audioTranscript, music } = context;
    const { frameDetections, transcriptSegments, sourceWidth, sourceHeight } = context;
    const { scene, objects, colors, tags } = visualization;

    const indoorLabel =
      scene.indoor === true ? 'intérieur' : scene.indoor === false ? 'extérieur' : 'indéterminé';
    const responseLang = lang === 'en' ? 'anglais' : 'français';

    // Éléments : vidéo → résumé par piste (apparition + position dans le temps) ; image → liste avec
    // position relative ; repli (vidéo sans détections par frame) → périodes d'apparition par label.
    const hasFrames = Boolean(frameDetections && frameDetections.length > 0);
    const elementsHeader = hasFrames
      ? '**Éléments visibles (apparition et position au fil du temps) :**\n'
      : '**Éléments visibles :** ';
    const elementsText =
      frameDetections && frameDetections.length > 0
        ? summarizeTracks(frameDetections, sourceWidth, sourceHeight, lang)
        : objects.length > 0
          ? formatImageObjects(objects, sourceWidth, sourceHeight, lang)
          : timeline && timeline.length > 0
            ? summarizeTimeline(timeline)
            : 'aucun';

    // Ce qui est dit : transcription minutée si disponible (situe les propos dans le temps).
    const speechText =
      transcriptSegments && transcriptSegments.length > 0
        ? `\n\n**Ce qui est dit :**\n${transcriptSegments
            .map((s) => `- [${timecode(s.start)}] ${s.text}`)
            .join('\n')}`
        : audioTranscript
          ? `\n\n**Ce qui est dit :** « ${audioTranscript} »`
          : '';

    const musicText =
      music && music.length > 0
        ? `\n\n**Musique :** ${music
            .map((m) => `${m.artist} — ${m.title}${m.album ? ` (album : ${m.album})` : ''}`)
            .join(' ; ')}`
        : '';

    // Règles spécifiques au minutage (vidéos avec apparitions datées) : ancrer les réponses
    // temporelles sur la liste réelle et rester honnête sur l'identité des sujets.
    const temporalRules = hasFrames
      ? `
- Pour toute question de minutage (« à quel moment… », « tu le vois encore ensuite ? », « donne les timecodes »), appuie-toi EXCLUSIVEMENT sur les moments d'apparition listés ci-dessus : ce sont tes repères temporels exacts. N'invente aucun autre horaire.
- Ces moments indiquent QUAND un sujet est visible, pas LEQUEL : les noms de personnages relèvent de ta reconnaissance visuelle. Si tu ne peux pas relier de façon certaine un personnage nommé à un intervalle précis, donne les intervalles de présence sans inventer ni intervertir les personnages, et dis-le franchement (« je distingue des apparitions à …, mais je ne peux pas garantir lequel à chaque instant »). Reste cohérent avec ce que tu as déjà affirmé dans la conversation.`
      : '';

    return `Tu es Dyper, une intelligence d'analyse visuelle. C'est toi qui as observé le média ci-dessous (image ou vidéo, joint au message quand il est disponible) : tout ce qui suit est ta propre perception, pas le travail d'un outil tiers. Réponds comme si tu avais le média sous les yeux.

Ta perception du média :

**Aperçu :** ${description}

**Scène :** ${scene.label} (${indoorLabel})

${elementsHeader}${elementsText}

**Couleurs dominantes :** ${colors.join(', ') || 'non disponibles'}

**Mots-clés :** ${tags.join(', ') || 'aucun'}${speechText}${musicText}

Façon de répondre :
- Tu ES Dyper. Si tu te désignes, parle à la première personne ; ne te présente jamais comme un assistant qui commente une analyse, et ne parle jamais de « Dyper » ou d'un « système » à la troisième personne.
- Tu es avant tout un interlocuteur : tu CONVERSES, tu ne récites pas. Lis le message de l'utilisateur et la conversation jusqu'ici, puis réponds précisément à CE qui est demandé.
- Si le message n'est pas une question sur le média — salutation, « ça va ? », « ok », « merci », remarque ou réaction générale —, réponds naturellement et brièvement comme dans une vraie conversation, SANS décrire le média. Ex. : à « ça va ? », réponds « Oui, et toi ? Tu veux que je regarde quelque chose en particulier ? ». Ne redécris le contenu QUE si on te le demande.
- Ne redécris jamais la scène que tu as déjà décrite et ne répète pas une information déjà donnée dans la conversation : appuie-toi sur ce qui a déjà été dit et apporte du nouveau. Évite la formule d'ouverture systématique « Je vois… ».
- Traite ta perception ci-dessus ET ce que tu vois comme UNE SEULE connaissance du média : ne distingue jamais « ce qui a été détecté » de « ce que tu déduis ».
- N'évoque jamais tes rouages ni tes sources internes — ni « système », « outil », « analyse », « détection », « données », ni les rubriques ci-dessus (« transcription », « chronologie », « audio », « couleurs », « tags »…), ni pourcentages ou coordonnées. Sers-toi de leur contenu comme d'une chose que tu sais, sans dire d'où il vient. Ex. : écris « il s'exprime avec véhémence », jamais « comme en témoigne la transcription ». Pas non plus de « d'après l'image », « selon l'analyse » ni « cela n'a pas été détecté » : affirme directement.
- Déduis et complète librement à partir de ce que tu vois (race, modèle, marque, contexte…). Si une indication interne te paraît fausse au vu du média, fie-toi au média et corrige sans le signaler. Si tu n'es pas certain, dis-le simplement (« on dirait… »).
- Va droit au but : commence par répondre à la question posée, puis n'ajoute que les détails pertinents. Ex. : à « reconnais-tu cette personne ? », réponds « Non, je ne l'identifie pas, mais… » — pas une description complète de la scène.${temporalRules}
- Reste factuel, direct, naturel et concis, en ${responseLang}.`;
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
    /** Tours antérieurs de la conversation (mémoire du fil) — l'image n'est jointe qu'au dernier. */
    history?: ChatTurn[];
  }): Promise<{ answer: string; model: string }> {
    const { question, context, lang = 'fr', imageBase64, history = [] } = params;
    const client = this.getClient();

    logger.info('Appel vers Groq pour le chat.', { lang, vision: Boolean(imageBase64) });

    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          { role: 'system' as const, content: this.buildSystemPrompt(context, lang) },
          ...history.map((t) => ({ role: t.role, content: t.content })),
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
    /** Tours antérieurs de la conversation (mémoire du fil) — l'image n'est jointe qu'au dernier. */
    history?: ChatTurn[];
  }): Promise<{ stream: Stream<ChatCompletionChunk>; model: string }> {
    const { question, context, lang = 'fr', imageBase64, history = [] } = params;
    const client = this.getClient();

    logger.info('Ouverture du flux de chat Groq.', { lang, vision: Boolean(imageBase64) });

    try {
      const stream = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        stream: true,
        messages: [
          { role: 'system' as const, content: this.buildSystemPrompt(context, lang) },
          ...history.map((t) => ({ role: t.role, content: t.content })),
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
