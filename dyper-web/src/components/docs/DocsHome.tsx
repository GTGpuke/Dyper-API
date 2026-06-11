// Accueil de la documentation : héros, cartes de départ et grille des capacités.
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../../contexts/I18nContext'
import type { Lang } from '../../i18n/translations'

type Localized = Record<Lang, string>
const L = (fr: string, en: string): Localized => ({ fr, en })

// Carte héros (contenu bilingue local, comme les guides).
const HERO = {
  title: L('Votre première analyse en quelques minutes', 'Your first analysis in minutes'),
  desc: L(
    'Créez un compte, récupérez la clé applicative et envoyez une image ou une vidéo : l’API renvoie une description riche, les objets localisés, la transcription et les chapitres.',
    'Create an account, grab the app key and send an image or a video: the API returns a rich description, located objects, the transcript and chapters.'
  ),
  cta: L('Démarrage rapide', 'Quickstart'),
  baseUrl: L('URL de base :', 'Base URL:'),
}

// Cartes de départ (contenu bilingue local, comme les guides).
const START_CARDS: Array<{ to: string; title: Localized; desc: Localized; icon: string }> = [
  {
    to: '/api-docs/guide/quickstart',
    title: L('Démarrage rapide', 'Quickstart'),
    desc: L('Votre première analyse en cinq minutes.', 'Your first analysis in five minutes.'),
    icon: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
  },
  {
    to: '/api-docs/guide/authentication',
    title: L('Authentification', 'Authentication'),
    desc: L('Clé applicative, session et médias.', 'App key, session and media access.'),
    icon: 'M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v3h6V7a3 3 0 0 0-3-3z',
  },
  {
    to: '/api-docs/reference/analyze',
    title: L('Référence API', 'API reference'),
    desc: L('Tous les endpoints, avec exemples en 3 langages.', 'Every endpoint, with samples in 3 languages.'),
    icon: 'M8 4l-5 8 5 8M16 4l5 8-5 8',
  },
]

// Capacités mises en avant.
const CAPABILITIES: Array<{ title: Localized; desc: Localized }> = [
  {
    title: L('Analyse d’images', 'Image analysis'),
    desc: L(
      'Description riche par modèle vision et objets localisés à vocabulaire ouvert — bien au-delà de 80 classes.',
      'Rich vision-model description and open-vocabulary located objects — far beyond 80 classes.'
    ),
  },
  {
    title: L('Vidéo chapitrée', 'Chaptered video'),
    desc: L(
      '3 images/s trackées, chapitres alignant ce qu’on voit et ce qu’on entend, lecteur annoté.',
      '3 tracked frames/s, chapters aligning sight and sound, annotated player.'
    ),
  },
  {
    title: L('Transcription & musique', 'Transcript & music'),
    desc: L(
      'Transcription horodatée (Whisper) et bande-son identifiée (fingerprinting).',
      'Timestamped transcript (Whisper) and identified soundtrack (fingerprinting).'
    ),
  },
  {
    title: L('Liens YouTube / Twitch', 'YouTube / Twitch links'),
    desc: L(
      'Téléchargement contrôlé par liste blanche, puis analyse vidéo complète.',
      'Allow-listed controlled download, then full video analysis.'
    ),
  },
  {
    title: L('Chat vision', 'Vision chat'),
    desc: L(
      'Questions de suivi fondées sur l’image elle-même, avec objets numérotés et chapitres.',
      'Follow-up questions grounded in the image itself, with numbered objects and chapters.'
    ),
  },
  {
    title: L('Streaming SSE', 'SSE streaming'),
    desc: L(
      'Réponses token par token, annulables, avec erreurs propres avant l’ouverture du flux.',
      'Token-by-token answers, cancellable, with clean errors before the stream opens.'
    ),
  },
]

export function DocsHome() {
  const { t, lang } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  // Compatibilité des anciens liens à ancres : /api-docs#section-<id> → page de référence.
  useEffect(() => {
    const match = /^#section-(.+)$/.exec(location.hash)
    if (match) navigate(`/api-docs/reference/${match[1]}`, { replace: true })
  }, [location.hash, navigate])

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
        {t('docs.title')}
      </h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-500 dark:text-ink-400">
        {t('docs.subtitle')}
      </p>

      {/* Carte héros : appel à l'action vers le démarrage rapide. */}
      <div className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-violet-600 to-violet-800 p-6 sm:p-8">
        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          {HERO.title[lang]}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80">{HERO.desc[lang]}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            to="/api-docs/guide/quickstart"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition-all hover:brightness-95"
          >
            {HERO.cta[lang]} →
          </Link>
          <Link
            to="/api-docs/reference/analyze"
            className="rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            {t('docs.group.reference')}
          </Link>
          <code className="ml-auto hidden rounded-lg bg-white/10 px-3 py-1.5 font-mono text-xs text-white/90 sm:block">
            {HERO.baseUrl[lang]} http://localhost:3000
          </code>
        </div>
      </div>

      {/* Cartes de départ. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {START_CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group rounded-2xl border border-ink-200 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-card-hover dark:border-ink-700 dark:hover:border-brand-500"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-white">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={card.icon} />
              </svg>
            </span>
            <h2 className="mt-3 font-semibold text-ink-900 group-hover:text-brand-600 dark:text-ink-50 dark:group-hover:text-brand-300">
              {card.title[lang]}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
              {card.desc[lang]}
            </p>
          </Link>
        ))}
      </div>

      {/* Capacités. */}
      <h2 className="mt-12 text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
        {t('docs.capabilities')}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {CAPABILITIES.map((cap) => (
          <div
            key={cap.title.fr}
            className="rounded-2xl border border-ink-200 p-4 dark:border-ink-700"
          >
            <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">
              {cap.title[lang]}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
              {cap.desc[lang]}
            </p>
          </div>
        ))}
      </div>

      {/* Encadré d'authentification (rappel essentiel). */}
      <div className="mt-12 rounded-2xl border border-brand-300/50 bg-brand-500/5 p-5 dark:border-brand-500/30">
        <h2 className="text-sm font-semibold text-brand-700 dark:text-brand-300">
          {t('docs.auth.title')}
        </h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          <li>{t('docs.auth.appKey')}</li>
          <li>{t('docs.auth.cookie')}</li>
        </ul>
      </div>
    </div>
  )
}
