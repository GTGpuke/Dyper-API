// Fond animé de marque : orbes dégradées floutées qui dérivent lentement, derrière les écrans
// d'état (chargement, 404, maintenance). Décoratif et non interactif.
import { motion } from 'framer-motion'

const INF = Number.POSITIVE_INFINITY

export function AnimatedBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl dark:bg-blue-500/20"
        animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 15, repeat: INF, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-20 top-1/4 h-96 w-96 rounded-full bg-violet-600/25 blur-3xl dark:bg-violet-600/20"
        animate={{ x: [0, -40, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 19, repeat: INF, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-28 left-1/3 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl dark:bg-fuchsia-500/15"
        animate={{ x: [0, 40, 0], y: [0, -40, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 17, repeat: INF, ease: 'easeInOut' }}
      />
      {/* Voile pour fondre les orbes dans le fond. */}
      <div className="absolute inset-0 bg-white/40 dark:bg-ink-950/40" />
    </div>
  )
}
