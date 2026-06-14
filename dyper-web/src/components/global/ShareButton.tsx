// Bouton de partage : copie le lien public (/p/:slug) dans le presse-papiers avec retour visuel.
import { useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'

export function ShareButton({ slug, className }: { slug: string; className?: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  function share(): void {
    const url = `${window.location.origin}/p/${slug}`
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => undefined
    )
  }

  return (
    <button
      type="button"
      onClick={share}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200',
        className
      )}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      {copied ? t('global.shared') : t('global.share')}
    </button>
  )
}
