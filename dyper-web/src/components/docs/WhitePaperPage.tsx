// Livre blanc Dyper — présenté dans son propre onglet de documentation, façon article scientifique.
// Le contenu est bilingue (FR/EN) et rendu selon la langue active. Volontairement hors i18n (t())
// car il s'agit de prose longue : la parité de clés n'aurait pas de sens ici.
import { useI18n } from '../../contexts/I18nContext'
import type { Lang } from '../../i18n/translations'

type Bilingual = Record<Lang, string>
type ParaList = Record<Lang, string[]>

interface Section {
  id: string
  title: Bilingual
  paragraphs: ParaList
}

const TITLE: Bilingual = {
  fr: 'Dyper : une passerelle de compréhension visuelle multimodale à débit maîtrisé',
  en: 'Dyper: a throughput-controlled gateway for multimodal visual understanding',
}

const META: Bilingual = {
  fr: 'Livre blanc technique · Version 2.1 · Équipe Dyper',
  en: 'Technical white paper · Version 2.1 · Dyper Team',
}

const ABSTRACT: Bilingual = {
  fr: "Dyper transforme une image, une vidéo ou un lien de plateforme en une analyse structurée — objets localisés et suivis dans le temps, scène, couleurs, description en langage naturel, transcription audio et reconnaissance musicale — exploitable par une couche conversationnelle ancrée. Ce document décrit l'architecture en trois services, le pipeline de vision à vocabulaire ouvert fusionné, la compréhension multimodale, ainsi que le modèle de service : quotas par forfait, allocation de capacité à file prioritaire et annulation coopérative. L'objectif est un système à backend unique, prévisible sous charge, exposé via une API publique versionnée.",
  en: 'Dyper turns an image, a video or a platform link into a structured analysis — objects localized and tracked over time, scene, colors, a natural-language description, audio transcription and music recognition — consumable by a grounded conversational layer. This document describes the three-service architecture, the fused open-vocabulary vision pipeline, multimodal understanding, and the serving model: per-plan quotas, priority-queued capacity allocation and cooperative cancellation. The goal is a single-backend system, predictable under load, exposed through a versioned public API.',
}

const SECTIONS: Section[] = [
  {
    id: 'intro',
    title: { fr: '1. Introduction', en: '1. Introduction' },
    paragraphs: {
      fr: [
        "La reconnaissance visuelle moderne ne se limite plus à étiqueter une image : les usages réels exigent de localiser les objets, de les suivre dans le temps, de décrire une scène en langage naturel et de relier l'image au son. Dyper assemble ces capacités en un service unique, conçu pour une démonstration crédible autant que pour une mise en production maîtrisée.",
        "Le système privilégie trois propriétés : la couverture (ne rien laisser passer grâce à un vocabulaire ouvert), la fidélité (des sorties cohérentes et vérifiables) et la prévisibilité (un débit stable même lorsque de nombreux utilisateurs sollicitent un backend unique).",
      ],
      en: [
        'Modern visual recognition is no longer about labeling an image: real use cases require localizing objects, tracking them over time, describing a scene in natural language and relating image to sound. Dyper assembles these capabilities into a single service, designed to be both a credible demo and a controlled production deployment.',
        'The system favors three properties: coverage (miss nothing, via an open vocabulary), fidelity (coherent, verifiable outputs) and predictability (stable throughput even when many users hit a single backend).',
      ],
    },
  },
  {
    id: 'architecture',
    title: { fr: '2. Architecture du système', en: '2. System architecture' },
    paragraphs: {
      fr: [
        "Dyper se décompose en trois services. dyper-ai (FastAPI, Python) héberge le moteur d'inférence et n'est jamais exposé publiquement. dyper-api (Fastify, TypeScript) est la passerelle : authentification, quotas, allocation de capacité, persistance et couche conversationnelle. dyper-web (React) fournit l'interface.",
        "La frontière de sécurité est nette : seule la passerelle appelle le moteur, sur le réseau privé, au moyen d'une clé interne comparée à temps constant. Les sessions utilisateur reposent sur un cookie httpOnly signé, avec versionnement de jeton pour une révocation globale.",
      ],
      en: [
        'Dyper is split into three services. dyper-ai (FastAPI, Python) hosts the inference engine and is never publicly exposed. dyper-api (Fastify, TypeScript) is the gateway: authentication, quotas, capacity allocation, persistence and the conversational layer. dyper-web (React) provides the interface.',
        'The security boundary is sharp: only the gateway calls the engine, over the private network, using an internal key compared in constant time. User sessions rely on a signed httpOnly cookie, with token versioning for global revocation.',
      ],
    },
  },
  {
    id: 'vision',
    title: { fr: '3. Pipeline de vision à vocabulaire ouvert', en: '3. Open-vocabulary vision pipeline' },
    paragraphs: {
      fr: [
        "Le cœur visuel fusionne deux détecteurs complémentaires : un détecteur sur classes fermées, précis sur son périmètre, et un détecteur à vocabulaire ouvert dérivé d'une grande nomenclature, qui assure la couverture. La fusion est spatiale — une boîte par objet, le détecteur le plus fiable l'emportant — afin d'éviter les doublons tout en maximisant le rappel.",
        "En vidéo, chaque image échantillonnée est détectée puis fusionnée, et les identités sont stabilisées dans le temps par un suivi multi-objets s'appuyant sur le mouvement, la position, l'apparence et le label. Une détection de coupures de plan réinitialise le suivi aux changements de scène, évitant de relier des objets de clips distincts.",
        "La scène et la palette de couleurs sont inférées à partir des détections ; un seuil d'affichage sépare les détections prioritaires des détections incertaines, ces dernières restant disponibles mais non comptabilisées dans le compte rendu.",
      ],
      en: [
        'The visual core fuses two complementary detectors: a closed-set detector, precise within its scope, and an open-vocabulary detector derived from a large nomenclature, which provides coverage. Fusion is spatial — one box per object, the more reliable detector winning — to avoid duplicates while maximizing recall.',
        'For video, each sampled frame is detected then fused, and identities are stabilized over time by a multi-object tracker leveraging motion, position, appearance and label. Scene-cut detection resets the tracker at scene changes, avoiding linking objects across distinct clips.',
        'Scene and color palette are inferred from detections; a display threshold separates priority detections from uncertain ones, the latter remaining available but excluded from the report.',
      ],
    },
  },
  {
    id: 'multimodal',
    title: { fr: '4. Compréhension multimodale', en: '4. Multimodal understanding' },
    paragraphs: {
      fr: [
        "Au-delà de la détection, Dyper produit une description en langage naturel ancrée sur les éléments réellement observés, transcrit la bande sonore et identifie la musique par empreinte acoustique. Pour la vidéo, la chronologie d'apparition des objets et la transcription horodatée situent les événements dans le temps.",
        "Ces signaux sont fusionnés en un contrat de réponse unique et stable, ce qui permet aux clients de consommer une analyse complète sans connaître les détails internes du moteur.",
      ],
      en: [
        'Beyond detection, Dyper produces a natural-language description grounded on the elements actually observed, transcribes the soundtrack and identifies music via acoustic fingerprinting. For video, the object-appearance timeline and the timestamped transcript situate events in time.',
        'These signals are merged into a single, stable response contract, letting clients consume a complete analysis without knowing the engine internals.',
      ],
    },
  },
  {
    id: 'conversation',
    title: { fr: '5. Couche conversationnelle ancrée', en: '5. Grounded conversational layer' },
    paragraphs: {
      fr: [
        "Une fois l'analyse produite, l'utilisateur peut interroger le média. Le contexte transmis au modèle de langage comprend les positions des objets dans le temps, la transcription horodatée et les dimensions de la source, de sorte que les réponses restent ancrées dans l'observation plutôt que dans la spéculation. Les réponses sont diffusées en flux (SSE) et annulables.",
      ],
      en: [
        'Once the analysis is produced, the user can question the media. The context handed to the language model includes object positions over time, the timestamped transcript and source dimensions, so answers stay grounded in observation rather than speculation. Answers are streamed (SSE) and cancellable.',
      ],
    },
  },
  {
    id: 'serving',
    title: { fr: '6. Service & allocation de capacité', en: '6. Serving & capacity allocation' },
    paragraphs: {
      fr: [
        "Un backend unique impose une discipline de débit. La passerelle borne le nombre d'analyses simultanées par un sémaphore ; au-delà, les requêtes patientent dans une file d'attente prioritaire. La priorité dépend du forfait, jamais la qualité : toutes les offres partagent exactement la même puissance d'analyse. Seuls diffèrent les volumes mensuels, les tailles de fichier et l'ordre de passage.",
        "L'annulation est coopérative de bout en bout : si le client interrompt une requête, la passerelle ferme la connexion vers le moteur, qui vérifie périodiquement la déconnexion et abandonne le travail en cours — aucun calcul n'est gaspillé.",
        "Les quotas mensuels (analyses, minutes vidéo) sont appliqués par la passerelle et réinitialisés par période. Ce découpage maintient un service réactif sous charge sans dégrader la qualité d'aucun traitement.",
      ],
      en: [
        'A single backend demands throughput discipline. The gateway bounds concurrent analyses with a semaphore; beyond that, requests wait in a priority queue. Priority depends on the plan, never on quality: every tier shares the exact same analysis power. Only monthly volumes, file sizes and ordering differ.',
        'Cancellation is cooperative end-to-end: if the client aborts a request, the gateway closes the connection to the engine, which periodically checks for disconnection and abandons in-flight work — no compute is wasted.',
        'Monthly quotas (analyses, video minutes) are enforced by the gateway and reset per period. This split keeps the service responsive under load without degrading the quality of any single job.',
      ],
    },
  },
  {
    id: 'api',
    title: { fr: '7. Conception de l’API publique', en: '7. Public API design' },
    paragraphs: {
      fr: [
        "L'API est versionnée sous /api/v1, le préfixe historique /api restant un alias de compatibilité. Toutes les réponses suivent une enveloppe uniforme et portent un identifiant de requête (X-Request-Id) propagé jusqu'au moteur, pour une traçabilité de bout en bout. Les sorties sont configurables (sélection de champs), à la manière des API publiques matures, et la limitation de débit est annoncée par des en-têtes standard.",
      ],
      en: [
        'The API is versioned under /api/v1, with the legacy /api prefix kept as a compatibility alias. All responses follow a uniform envelope and carry a request identifier (X-Request-Id) propagated down to the engine, for end-to-end traceability. Outputs are configurable (field selection), as in mature public APIs, and rate limiting is advertised via standard headers.',
      ],
    },
  },
  {
    id: 'limitations',
    title: { fr: '8. Limites & perspectives', en: '8. Limitations & future work' },
    paragraphs: {
      fr: [
        "Le modèle mono-instance privilégie la simplicité et le coût : la base est embarquée (SQLite), les médias sont sur disque local et la file de capacité vit en mémoire. La montée en charge se fait verticalement (GPU plus puissant, concurrence accrue). Une mise à l'échelle horizontale supposerait une base managée, un stockage objet et une file partagée — extension naturelle laissée aux versions ultérieures.",
        "Les pistes futures incluent l'export structuré (sous-titres, JSON enrichi), des webhooks, et un raffinement continu de la couverture du vocabulaire ouvert sous contrainte de budget de calcul.",
      ],
      en: [
        'The single-instance model favors simplicity and cost: the database is embedded (SQLite), media live on local disk and the capacity queue is in-memory. Scaling is vertical (more powerful GPU, higher concurrency). Horizontal scaling would require a managed database, object storage and a shared queue — a natural extension left to later versions.',
        'Future directions include structured export (subtitles, enriched JSON), webhooks, and continuous refinement of open-vocabulary coverage under a compute budget.',
      ],
    },
  },
]

const REFERENCES: string[] = [
  'Redmon et al., “You Only Look Once: Unified, Real-Time Object Detection”, CVPR 2016.',
  'Cheng et al., “YOLO-World: Real-Time Open-Vocabulary Object Detection”, CVPR 2024.',
  'Gupta et al., “LVIS: A Dataset for Large Vocabulary Instance Segmentation”, CVPR 2019.',
  'Radford et al., “Learning Transferable Visual Models From Natural Language Supervision (CLIP)”, ICML 2021.',
  'Radford et al., “Robust Speech Recognition via Large-Scale Weak Supervision (Whisper)”, 2022.',
]

export function WhitePaperPage() {
  const { lang } = useI18n()
  const refsTitle = lang === 'fr' ? 'Références' : 'References'
  const abstractTitle = lang === 'fr' ? 'Résumé' : 'Abstract'

  return (
    <article className="mx-auto max-w-3xl">
      <header className="border-b border-ink-100 pb-6 dark:border-ink-800">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink-900 dark:text-ink-50">
          {TITLE[lang]}
        </h1>
        <p className="mt-2 text-sm text-ink-400 dark:text-ink-500">{META[lang]}</p>
      </header>

      <section className="mt-6 rounded-xl bg-ink-50 p-5 dark:bg-ink-950/60">
        <p className="eyebrow mb-1.5">{abstractTitle}</p>
        <p className="text-[15px] leading-relaxed text-ink-700 dark:text-ink-200">
          {ABSTRACT[lang]}
        </p>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.id} className="mt-8">
          <h2 className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
            {section.title[lang]}
          </h2>
          {section.paragraphs[lang].map((para, index) => (
            <p
              // Index acceptable : contenu statique, ordre stable.
              key={index}
              className="mt-3 text-[15px] leading-relaxed text-ink-600 dark:text-ink-300"
            >
              {para}
            </p>
          ))}
        </section>
      ))}

      <section className="mt-10 border-t border-ink-100 pt-6 dark:border-ink-800">
        <h2 className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
          {refsTitle}
        </h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-500 dark:text-ink-400">
          {REFERENCES.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ol>
      </section>
    </article>
  )
}
