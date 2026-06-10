// Barre de progression représentant un score de confiance (0–1).
import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { formatConfidence } from '../../utils/formatters'

export function ConfidenceBar({
  value,
  showLabel = true,
  className,
}: {
  value: number
  showLabel?: boolean
  className?: string
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  // Teinte selon la confiance : faible (ambre) → élevée (émeraude).
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 45 ? 'bg-brand-500' : 'bg-amber-500'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-700">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      {showLabel && (
        <span className="w-9 shrink-0 text-right font-mono text-xs text-ink-500 dark:text-ink-400">
          {formatConfidence(value)}
        </span>
      )}
    </div>
  )
}
