// État vide générique (aucune donnée, liste vide…).
import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-200 bg-white/50 px-6 py-16 text-center dark:border-ink-700 dark:bg-ink-800/30">
      {icon && <div className="text-ink-300 dark:text-ink-600">{icon}</div>}
      <h3 className="text-base font-semibold text-ink-700 dark:text-ink-200">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-500 dark:text-ink-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
