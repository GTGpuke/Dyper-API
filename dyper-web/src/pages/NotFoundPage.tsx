// Page 404 : « 404 » en grand dégradé flottant, message et retour à l'accueil, sur fond animé.
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import logo from '../assets/dyper-logo.svg'
import { AnimatedBackdrop } from '../components/feedback/AnimatedBackdrop'
import { useI18n } from '../contexts/I18nContext'

const INF = Number.POSITIVE_INFINITY

export function NotFoundPage() {
  const { t } = useI18n()

  return (
    <div className="relative grid h-screen place-items-center overflow-hidden bg-white px-4 dark:bg-ink-950">
      <AnimatedBackdrop />

      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <img src={logo} alt="" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-lg font-bold tracking-tight text-ink-900 dark:text-ink-50">Dyper</span>
        </Link>

        <motion.p
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
          transition={{
            opacity: { duration: 0.4 },
            scale: { duration: 0.4 },
            y: { duration: 5, repeat: INF, ease: 'easeInOut' },
          }}
          className="bg-gradient-to-br from-blue-500 to-violet-600 bg-clip-text text-8xl font-black leading-none tracking-tight text-transparent sm:text-9xl"
        >
          404
        </motion.p>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
          {t('notFound.title')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
          {t('notFound.desc')}
        </p>

        <Link
          to="/"
          className="mt-7 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:shadow-card-hover hover:brightness-110"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
          </svg>
          {t('notFound.cta')}
        </Link>
      </div>
    </div>
  )
}
