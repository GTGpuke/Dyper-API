// Contenu des guides de la documentation (bilingue, data-driven) : le texte long vit ici
// plutôt que dans translations.ts ; les libellés d'interface restent dans l'i18n.
import type { Lang } from '../i18n/translations'

type Localized = Record<Lang, string>

export type GuideBlock =
  | { type: 'h2'; text: Localized }
  | { type: 'p'; text: Localized }
  | { type: 'callout'; text: Localized }
  | { type: 'code'; title: string; language: 'bash' | 'javascript' | 'python' | 'json'; code: string }
  | { type: 'table'; headers: Localized[]; rows: Localized[][] }

export interface Guide {
  id: string
  title: Localized
  intro: Localized
  blocks: GuideBlock[]
}

const L = (fr: string, en: string): Localized => ({ fr, en })

export const GUIDES: Guide[] = [
  {
    id: 'quickstart',
    title: L('Démarrage rapide', 'Quickstart'),
    intro: L(
      'De zéro à votre première analyse d’image en cinq minutes.',
      'From zero to your first image analysis in five minutes.'
    ),
    blocks: [
      { type: 'h2', text: L('1. Créer un compte', '1. Create an account') },
      {
        type: 'p',
        text: L(
          'Toutes les requêtes vers /api exigent la clé applicative dans le header X-App-Key, et les routes de données exigent une session utilisateur (cookie httpOnly délivré à la connexion).',
          'Every /api request requires the application key in the X-App-Key header, and data routes require a user session (httpOnly cookie issued at login).'
        ),
      },
      {
        type: 'code',
        title: 'curl',
        language: 'bash',
        code: `curl -X POST http://localhost:3000/api/auth/register \\
  -H "X-App-Key: $APP_KEY" \\
  -H "Content-Type: application/json" \\
  -c cookies.txt \\
  -d '{"email": "vous@exemple.fr", "password": "motdepasse123"}'`,
      },
      { type: 'h2', text: L('2. Première analyse d’image', '2. First image analysis') },
      {
        type: 'code',
        title: 'curl',
        language: 'bash',
        code: `curl -X POST http://localhost:3000/api/analyze \\
  -H "X-App-Key: $APP_KEY" \\
  -b cookies.txt \\
  -F "file=@photo.jpg" \\
  -F "lang=fr"`,
      },
      {
        type: 'code',
        title: 'JavaScript',
        language: 'javascript',
        code: `const form = new FormData();
form.append('file', fileInput.files[0]);
form.append('lang', 'fr');

const res = await fetch('http://localhost:3000/api/analyze', {
  method: 'POST',
  headers: { 'X-App-Key': APP_KEY },
  credentials: 'include',
  body: form,
});
const { result } = await res.json();
console.log(result.description, result.visualization.objects);`,
      },
      { type: 'h2', text: L('3. Lire la réponse', '3. Read the response') },
      {
        type: 'p',
        text: L(
          'La réponse contient la description générée par le modèle vision, la scène, les objets localisés (boîtes englobantes en pixels dans le référentiel sourceWidth × sourceHeight), les couleurs dominantes et les tags.',
          'The response contains the vision-model description, the scene, located objects (pixel bounding boxes in the sourceWidth × sourceHeight reference frame), dominant colors and tags.'
        ),
      },
      {
        type: 'code',
        title: 'JSON',
        language: 'json',
        code: `{
  "success": true,
  "requestId": "8d57f38e-…",
  "result": {
    "description": "Un jeune homme se tient devant un enclos…",
    "visualization": {
      "objects": [
        { "label": "young man", "confidence": 0.92,
          "boundingBox": { "x": 120, "y": 60, "w": 230, "h": 540 } }
      ],
      "scene": { "label": "enclos de zoo", "confidence": 0.9, "indoor": false },
      "colors": ["#6b7f5a", "#c8c0b0", "#3a3f35"],
      "tags": ["young man", "elephant", "metal fence"]
    },
    "sourceWidth": 1280, "sourceHeight": 720
  }
}`,
      },
      {
        type: 'callout',
        text: L(
          'Étape suivante : envoyez une vidéo (≤ 5 minutes) sur le même endpoint pour obtenir chapitres, transcription et détections frame par frame.',
          'Next step: send a video (≤ 5 minutes) to the same endpoint to get chapters, transcript and per-frame detections.'
        ),
      },
    ],
  },
  {
    id: 'authentication',
    title: L('Authentification', 'Authentication'),
    intro: L(
      'Deux niveaux : la clé applicative identifie votre application, le cookie de session identifie l’utilisateur.',
      'Two levels: the application key identifies your app, the session cookie identifies the user.'
    ),
    blocks: [
      { type: 'h2', text: L('Clé applicative (X-App-Key)', 'Application key (X-App-Key)') },
      {
        type: 'p',
        text: L(
          'Toutes les routes /api la requièrent. Elle est configurée côté serveur (variable APP_KEY) et transmise dans le header X-App-Key de chaque requête.',
          'Required by every /api route. It is configured server-side (APP_KEY variable) and sent in the X-App-Key header of each request.'
        ),
      },
      { type: 'h2', text: L('Session utilisateur (cookie httpOnly)', 'User session (httpOnly cookie)') },
      {
        type: 'p',
        text: L(
          'POST /api/auth/login dépose un JWT dans le cookie httpOnly « dyper_token » (8 h). Conservez le pot à cookies (curl -c/-b) ou utilisez credentials: "include" en JavaScript. Chaque utilisateur ne voit que ses propres données.',
          'POST /api/auth/login sets a JWT in the httpOnly cookie “dyper_token” (8 h). Keep the cookie jar (curl -c/-b) or use credentials: "include" in JavaScript. Each user only ever sees their own data.'
        ),
      },
      {
        type: 'code',
        title: 'curl',
        language: 'bash',
        code: `# Connexion (enregistre le cookie de session)
curl -X POST http://localhost:3000/api/auth/login \\
  -H "X-App-Key: $APP_KEY" -H "Content-Type: application/json" \\
  -c cookies.txt \\
  -d '{"email": "vous@exemple.fr", "password": "motdepasse123"}'

# Requête authentifiée
curl http://localhost:3000/api/analyses -H "X-App-Key: $APP_KEY" -b cookies.txt`,
      },
      { type: 'h2', text: L('Médias : cookie seul', 'Media: cookie only') },
      {
        type: 'callout',
        text: L(
          'Exception : /api/media/* (miniatures et vidéos) n’exige PAS X-App-Key — uniquement le cookie. Les balises <img> et <video> ne pouvant pas envoyer de header personnalisé, vous pouvez les pointer directement sur ces URLs.',
          'Exception: /api/media/* (thumbnails and videos) does NOT require X-App-Key — only the cookie. Since <img> and <video> tags cannot send custom headers, you can point them straight at these URLs.'
        ),
      },
    ],
  },
  {
    id: 'errors',
    title: L('Erreurs & codes', 'Errors & codes'),
    intro: L(
      'Toutes les erreurs partagent la même enveloppe JSON, avec un code stable et un message en français.',
      'All errors share the same JSON envelope, with a stable code and a human-readable message.'
    ),
    blocks: [
      {
        type: 'code',
        title: 'JSON',
        language: 'json',
        code: `{
  "success": false,
  "requestId": "req-42",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Les données fournies sont invalides.",
    "details": {}
  }
}`,
      },
      { type: 'h2', text: L('Codes principaux', 'Main codes') },
      {
        type: 'table',
        headers: [L('Code', 'Code'), L('HTTP', 'HTTP'), L('Signification', 'Meaning')],
        rows: [
          [L('VALIDATION_ERROR', 'VALIDATION_ERROR'), L('400', '400'), L('Corps ou paramètres invalides.', 'Invalid body or parameters.')],
          [L('UNAUTHORIZED', 'UNAUTHORIZED'), L('401', '401'), L('Session absente ou expirée.', 'Missing or expired session.')],
          [L('INVALID_APP_KEY', 'INVALID_APP_KEY'), L('401', '401'), L('Header X-App-Key absent ou incorrect.', 'Missing or wrong X-App-Key header.')],
          [L('NOT_FOUND', 'NOT_FOUND'), L('404', '404'), L('Ressource inexistante ou appartenant à un autre utilisateur.', 'Resource missing or owned by another user.')],
          [L('FILE_TOO_LARGE', 'FILE_TOO_LARGE'), L('413', '413'), L('Fichier au-delà de la taille autorisée.', 'File exceeds the allowed size.')],
          [L('INVALID_FILE_TYPE', 'INVALID_FILE_TYPE'), L('415', '415'), L('Type MIME non pris en charge.', 'Unsupported MIME type.')],
          [L('AI_PROCESSING_ERROR', 'AI_PROCESSING_ERROR'), L('422', '422'), L('Le moteur d’analyse a rejeté la requête (ex. vidéo > 5 min).', 'The analysis engine rejected the request (e.g. video > 5 min).')],
          [L('RATE_LIMIT_EXCEEDED', 'RATE_LIMIT_EXCEEDED'), L('429', '429'), L('Trop de requêtes — réessayez plus tard.', 'Too many requests — retry later.')],
          [L('AI_TIMEOUT', 'AI_TIMEOUT'), L('504', '504'), L('Le moteur n’a pas répondu dans les délais.', 'The engine did not answer in time.')],
          [L('CHAT_NOT_CONFIGURED', 'CHAT_NOT_CONFIGURED'), L('503', '503'), L('Clé du fournisseur LLM absente côté serveur.', 'LLM provider key missing server-side.')],
        ],
      },
    ],
  },
  {
    id: 'video',
    title: L('Analyse vidéo & chapitres', 'Video analysis & chapters'),
    intro: L(
      'Une vidéo (≤ 5 minutes) est inspectée à 3 images/seconde : détections trackées frame par frame, transcription horodatée, chapitres alignant ce qu’on voit et ce qu’on entend.',
      'A video (≤ 5 minutes) is inspected at 3 frames/second: tracked per-frame detections, timestamped transcript, chapters aligning what is seen and heard.'
    ),
    blocks: [
      { type: 'h2', text: L('Champs spécifiques de la réponse', 'Video-specific response fields') },
      {
        type: 'table',
        headers: [L('Champ', 'Field'), L('Description', 'Description')],
        rows: [
          [L('frames', 'frames'), L('Détections complètes par frame échantillonnée : { t, objects[] } avec trackId stable — alimente le lecteur annoté.', 'Full detections per sampled frame: { t, objects[] } with stable trackId — powers the annotated player.')],
          [L('timeline', 'timeline'), L('Chronologie lissée de présence des objets : { t, labels[] }.', 'Smoothed object-presence timeline: { t, labels[] }.')],
          [L('chapters', 'chapters'), L('Chapitres ~20 s : { tStart, tEnd, description, elements[], transcript }.', '~20 s chapters: { tStart, tEnd, description, elements[], transcript }.')],
          [L('transcriptSegments', 'transcriptSegments'), L('Transcription horodatée : { start, end, text }.', 'Timestamped transcript: { start, end, text }.')],
          [L('audioTranscript', 'audioTranscript'), L('Transcription complète (texte).', 'Full transcript (plain text).')],
          [L('music', 'music'), L('Bande-son identifiée : { artist, title, album }.', 'Identified soundtrack: { artist, title, album }.')],
        ],
      },
      { type: 'h2', text: L('Relire la vidéo annotée', 'Replay the annotated video') },
      {
        type: 'p',
        text: L(
          'La vidéo originale est conservée et servie en streaming HTTP Range sur GET /api/media/{requestId}/video (cookie seul) : combinez currentTime du lecteur avec le tableau frames pour superposer les boîtes.',
          'The original video is stored and served with HTTP Range streaming at GET /api/media/{requestId}/video (cookie only): combine the player’s currentTime with the frames array to overlay boxes.'
        ),
      },
      {
        type: 'callout',
        text: L(
          'L’analyse approfondie prend du temps (plusieurs minutes pour une vidéo longue) : prévoyez un timeout client d’au moins 10 minutes sur cet appel.',
          'Deep analysis takes time (several minutes for a long video): allow a client timeout of at least 10 minutes on this call.'
        ),
      },
    ],
  },
  {
    id: 'platform-links',
    title: L('Liens YouTube & Twitch', 'YouTube & Twitch links'),
    intro: L(
      'Collez une URL de plateforme : la vidéo est téléchargée côté serveur (liste blanche stricte) puis passe par l’analyse vidéo complète.',
      'Paste a platform URL: the video is downloaded server-side (strict allow-list) then goes through the full video analysis.'
    ),
    blocks: [
      {
        type: 'code',
        title: 'curl',
        language: 'bash',
        code: `curl -X POST http://localhost:3000/api/analyze/url \\
  -H "X-App-Key: $APP_KEY" -b cookies.txt \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://www.youtube.com/watch?v=jNQXAC9IVRw", "lang": "fr"}'`,
      },
      {
        type: 'table',
        headers: [L('Contrainte', 'Constraint'), L('Valeur', 'Value')],
        rows: [
          [L('Plateformes', 'Platforms'), L('youtube.com, youtu.be (watch, Shorts) · twitch.tv (clips, VOD)', 'youtube.com, youtu.be (watch, Shorts) · twitch.tv (clips, VOD)')],
          [L('Durée maximale', 'Max duration'), L('5 minutes (vérifiée avant téléchargement)', '5 minutes (checked before download)')],
          [L('Qualité téléchargée', 'Downloaded quality'), L('720p maximum', 'Up to 720p')],
        ],
      },
      {
        type: 'p',
        text: L(
          'Une URL d’image classique sur le même endpoint déclenche simplement l’analyse d’image — la détection de plateforme est automatique.',
          'A regular image URL on the same endpoint simply triggers image analysis — platform detection is automatic.'
        ),
      },
    ],
  },
  {
    id: 'chat',
    title: L('Chat de suivi & streaming SSE', 'Follow-up chat & SSE streaming'),
    intro: L(
      'Posez des questions sur une analyse : le modèle voit l’image (miniature jointe côté serveur) et connaît les chapitres, la transcription et chaque objet localisé.',
      'Ask questions about an analysis: the model sees the image (thumbnail attached server-side) and knows the chapters, transcript and every located object.'
    ),
    blocks: [
      { type: 'h2', text: L('Réponse streamée (SSE)', 'Streamed answer (SSE)') },
      {
        type: 'p',
        text: L(
          'POST /api/conversations/{id}/messages/stream renvoie un flux Server-Sent Events : des trames data: {"delta": "…"} puis une trame event: done. Les erreurs métier (404, 503…) sont renvoyées en JSON AVANT l’ouverture du flux.',
          'POST /api/conversations/{id}/messages/stream returns a Server-Sent Events stream: data: {"delta": "…"} frames then an event: done frame. Business errors (404, 503…) are returned as JSON BEFORE the stream opens.'
        ),
      },
      {
        type: 'code',
        title: 'JavaScript',
        language: 'javascript',
        code: `const res = await fetch(\`/api/conversations/\${id}/messages/stream\`, {
  method: 'POST',
  headers: { 'X-App-Key': APP_KEY, 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ text: 'Que tient la personne à gauche ?' }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  for (const frame of decoder.decode(value).split('\\n\\n')) {
    if (frame.startsWith('data: ')) {
      const { delta } = JSON.parse(frame.slice(6));
      if (delta) process.stdout.write(delta);
    }
  }
}`,
      },
      {
        type: 'callout',
        text: L(
          'Annulation : fermez simplement la connexion (AbortController) — le serveur interrompt la génération immédiatement.',
          'Cancellation: just close the connection (AbortController) — the server stops generation immediately.'
        ),
      },
    ],
  },
]

/** Retourne un guide par identifiant, ou undefined. */
export function getGuide(id: string): Guide | undefined {
  return GUIDES.find((g) => g.id === id)
}
