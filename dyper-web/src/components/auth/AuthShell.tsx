// Coquille visuelle des pages d'authentification (logo + carte centrée).
import type { ReactNode } from 'react'
import logo from '../../assets/dyper-logo.svg'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 px-4 dark:bg-ink-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src={logo} alt="Dyper AI" className="h-12 w-12 rounded-2xl object-contain" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">{title}</h1>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>
          </div>
        </div>

        <div className="surface p-6">{children}</div>

        <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">{footer}</p>
      </div>
    </div>
  )
}

// Champ de formulaire étiqueté réutilisable.
export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">{label}</span>
      <input
        className="w-full rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400 focus:shadow-focus dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50"
        {...props}
      />
    </label>
  )
}
