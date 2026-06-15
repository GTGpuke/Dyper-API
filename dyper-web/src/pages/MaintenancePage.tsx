// Page de maintenance : engrenage animé, message rassurant et bouton « Réessayer », sur fond animé.
// Destinée à être affichée pendant une intervention (route /maintenance ou bascule applicative).
import { motion } from 'framer-motion'
import logo from '../assets/dyper-logo.svg'
import { AnimatedBackdrop } from '../components/feedback/AnimatedBackdrop'
import { useI18n } from '../contexts/I18nContext'

const INF = Number.POSITIVE_INFINITY

export function MaintenancePage() {
  const { t } = useI18n()

  return (
    <div className="relative grid h-screen place-items-center overflow-hidden bg-white px-4 dark:bg-ink-950">
      <AnimatedBackdrop />

      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        <div className="mb-8 flex items-center gap-2">
          <img src={logo} alt="" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-lg font-bold tracking-tight text-ink-900 dark:text-ink-50">Dyper</span>
        </div>

        {/* Engrenages : un grand qui tourne, un petit en sens inverse. */}
        <div className="relative grid h-24 w-24 place-items-center text-violet-500">
          <motion.svg
            className="h-20 w-20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: INF, ease: 'linear' }}
          >
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </motion.svg>
          <motion.svg
            className="absolute -bottom-1 -right-1 h-9 w-9 text-blue-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: -360 }}
            transition={{ duration: 8, repeat: INF, ease: 'linear' }}
          >
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </motion.svg>
        </div>

        <h1 className="mt-8 text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
          {t('maintenance.title')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
          {t('maintenance.desc')}
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-7 inline-flex items-center gap-1.5 rounded-xl border border-ink-300 px-5 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:border-violet-400 hover:text-violet-700 dark:border-ink-600 dark:text-ink-200 dark:hover:border-violet-500 dark:hover:text-violet-300"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
          </svg>
          {t('maintenance.retry')}
        </button>
      </div>
    </div>
  )
}
