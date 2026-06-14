// Puce de statistique / capacité : icône + libellé + valeur optionnelle. Réutilisée par le héros
// (vitrine des capacités, sans valeur) et la carte de résultat (ruban de stats, avec valeur).
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function StatChip({
  icon,
  label,
  value,
  className,
}: {
  /** Contenu SVG (chemins) de l'icône, dessiné dans un cadre 24×24. */
  icon: ReactNode
  label: string
  value?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-800/60',
        className
      )}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500/15 to-violet-600/15 text-violet-600 dark:text-violet-300">
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span className="min-w-0">
        {value !== undefined && (
          <span className="block truncate text-sm font-semibold text-ink-900 dark:text-ink-50">
            {value}
          </span>
        )}
        <span
          className={cn(
            'block truncate',
            value !== undefined
              ? 'text-xs text-ink-400 dark:text-ink-500'
              : 'text-sm font-medium text-ink-700 dark:text-ink-200'
          )}
        >
          {label}
        </span>
      </span>
    </div>
  )
}
