// Carte de réglage : titre, description et contenu, avec zone d'actions optionnelle.
import type { ReactNode } from 'react'

export function SettingsCard({
  title,
  description,
  children,
  danger,
}: {
  title: string
  description?: string
  children: ReactNode
  danger?: boolean
}) {
  return (
    <section
      className={
        'surface p-6 ' + (danger ? 'border-red-200 dark:border-red-900/50' : '')
      }
    >
      <h2
        className={
          'text-base font-semibold ' +
          (danger ? 'text-red-700 dark:text-red-400' : 'text-ink-900 dark:text-ink-50')
        }
      >
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

// Ligne libellé + contrôle, alignée.
export function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 py-4 first:border-0 first:pt-0 dark:border-ink-800">
      <div>
        <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{label}</p>
        {hint && <p className="text-xs text-ink-400 dark:text-ink-500">{hint}</p>}
      </div>
      {children}
    </div>
  )
}
