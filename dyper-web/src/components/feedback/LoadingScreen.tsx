// Écran de chargement plein écran : logo Dyper avec anneaux concentriques qui se propagent, ligne
// de scan (clin d'œil à l'analyse visuelle), barre shimmer et signature. Affiché pendant la
// restauration de session (bootstrap de l'app).
import { motion } from 'framer-motion'
import logo from '../../assets/dyper-logo.svg'
import { useI18n } from '../../contexts/I18nContext'
import { AnimatedBackdrop } from './AnimatedBackdrop'

const INF = Number.POSITIVE_INFINITY

export function LoadingScreen() {
  const { t } = useI18n()

  return (
    <div className="relative grid h-screen place-items-center overflow-hidden bg-white dark:bg-ink-950">
      <AnimatedBackdrop />

      <div className="relative z-10 flex flex-col items-center">
        {/* Halo + anneaux concentriques qui se propagent. */}
        <div className="relative grid h-28 w-28 place-items-center">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute h-20 w-20 rounded-[1.4rem] border border-violet-500/40"
              initial={{ scale: 0.7, opacity: 0.7 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 2.4, repeat: INF, ease: 'easeOut', delay: i * 0.8 }}
            />
          ))}

          <motion.div
            className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-blue-500 to-violet-600 shadow-card-hover"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: INF, ease: 'easeInOut' }}
          >
            <img src={logo} alt="" className="h-11 w-11 object-contain" />
            <motion.span
              className="pointer-events-none absolute inset-x-1.5 h-8 bg-gradient-to-b from-transparent via-white/45 to-transparent"
              animate={{ top: ['-25%', '110%'] }}
              transition={{ duration: 1.6, repeat: INF, ease: 'easeInOut' }}
            />
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50"
        >
          Dyper
        </motion.p>

        {/* Barre shimmer indéterminée. */}
        <div className="relative mt-3 h-1 w-44 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
          <motion.div
            className="absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
            animate={{ left: ['-50%', '100%'] }}
            transition={{ duration: 1.25, repeat: INF, ease: 'easeInOut' }}
          />
        </div>

        <p className="mt-4 text-xs text-ink-400 dark:text-ink-500">{t('loading.tagline')}</p>
      </div>
    </div>
  )
}
