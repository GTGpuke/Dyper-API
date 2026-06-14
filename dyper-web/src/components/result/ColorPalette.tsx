// Palette des couleurs dominantes, avec code hexadécimal copiable.
import { useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'

export function ColorPalette({ colors }: { colors: string[] }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState<string | null>(null)

  function copy(hex: string): void {
    navigator.clipboard?.writeText(hex).then(
      () => {
        setCopied(hex)
        setTimeout(() => setCopied(null), 1200)
      },
      () => undefined
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => copy(color)}
          className="group flex items-center gap-2 rounded-lg border border-ink-200 bg-white py-1 pl-1 pr-2.5 transition-colors hover:border-ink-300 dark:border-ink-700 dark:bg-ink-800 dark:hover:border-ink-600"
          title={t('result.copy')}
        >
          <span
            className="h-6 w-6 rounded-md ring-1 ring-inset ring-black/5"
            style={{ backgroundColor: color }}
          />
          <span className="font-mono text-xs text-ink-500 dark:text-ink-400">
            {copied === color ? t('result.copied') : color}
          </span>
        </button>
      ))}
    </div>
  )
}
