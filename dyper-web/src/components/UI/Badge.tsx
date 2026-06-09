// Étiquette compacte pour types, scènes et métadonnées.
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'neutral' | 'brand' | 'green' | 'amber' | 'slate'

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  slate: 'bg-ink-800 text-white dark:bg-ink-200 dark:text-ink-900',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
