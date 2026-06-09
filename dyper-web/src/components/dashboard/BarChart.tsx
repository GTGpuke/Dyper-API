// Mini-graphe en barres horizontales (sans dépendance externe).
import { motion } from 'framer-motion'

export interface BarDatum {
  label: string
  value: number
}

export function BarChart({ data }: { data: BarDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d, i) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm capitalize text-ink-600 dark:text-ink-300">{d.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-700">
            <motion.div
              className="h-full rounded-full bg-brand-500"
              initial={{ width: 0 }}
              animate={{ width: `${(d.value / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
            />
          </div>
          <span className="w-8 shrink-0 text-right font-mono text-xs text-ink-500 dark:text-ink-400">{d.value}</span>
        </div>
      ))}
    </div>
  )
}
