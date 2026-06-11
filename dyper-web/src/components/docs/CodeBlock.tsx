// Bloc de code avec bouton de copie (surface sombre fixe dans les deux thèmes, style Stripe).
// Avec « title » ou « tabs », le bloc devient un panneau à barre d'en-tête (titre, onglets, copie).
import { useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'

interface CodeTab {
  id: string
  label: string
}

export function CodeBlock({
  code,
  title,
  tabs,
  activeTab,
  onTabSelect,
}: {
  code: string
  title?: string
  tabs?: CodeTab[]
  activeTab?: string
  onTabSelect?: (id: string) => void
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  function copy(): void {
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => undefined
    )
  }

  // Variante nue : pas d'en-tête, bouton de copie flottant.
  if (!title && !tabs) {
    return (
      <div className="relative">
        <pre className="overflow-x-auto rounded-xl bg-ink-900 p-4 font-mono text-[13px] leading-relaxed text-ink-100">
          {code}
        </pre>
        <button
          type="button"
          onClick={copy}
          className="absolute right-2 top-2 rounded-lg bg-white/10 px-2 py-1 text-xs text-ink-200 transition-colors hover:bg-white/20"
        >
          {copied ? t('docs.copied') : t('docs.copy')}
        </button>
      </div>
    )
  }

  // Variante panneau : barre d'en-tête avec titre, onglets éventuels et bouton de copie.
  return (
    <div className="overflow-hidden rounded-xl bg-ink-900">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5">
        {title && (
          <span className="px-1 font-mono text-xs font-medium text-ink-400">{title}</span>
        )}
        {tabs && (
          <div className="flex items-center gap-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabSelect?.(tab.id)}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  tab.id === activeTab
                    ? 'bg-white/15 text-white'
                    : 'text-ink-400 hover:bg-white/10 hover:text-ink-200'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={copy}
          className="ml-auto rounded-md px-2 py-1 text-xs text-ink-400 transition-colors hover:bg-white/10 hover:text-ink-200"
        >
          {copied ? t('docs.copied') : t('docs.copy')}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-ink-100">
        {code}
      </pre>
    </div>
  )
}
