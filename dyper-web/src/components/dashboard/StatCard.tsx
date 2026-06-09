// Carte de statistique synthétique pour le tableau de bord.
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface flex flex-col gap-1 p-5"
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {icon && <span className="text-ink-300 dark:text-ink-600">{icon}</span>}
      </div>
      <span className="text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">{value}</span>
      {hint && <span className="text-xs text-ink-400 dark:text-ink-500">{hint}</span>}
    </motion.div>
  )
}
