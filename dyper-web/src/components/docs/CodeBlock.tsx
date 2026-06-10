// Bloc de code avec bouton de copie (surface sombre fixe dans les deux thèmes, style Stripe).
import { useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'

export function CodeBlock({ code }: { code: string }) {
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
