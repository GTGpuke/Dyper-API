// En-tête de page : titre, sous-titre et zone d'actions optionnelle.
import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8 sm:gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}
