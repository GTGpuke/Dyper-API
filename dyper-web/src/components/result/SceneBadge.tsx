// Badge de scène inférée : libellé, intérieur/extérieur et confiance.
import { Badge } from '../ui/Badge'
import { useI18n } from '../../contexts/I18nContext'
import { formatConfidence } from '../../utils/formatters'

export function SceneBadge({
  label,
  confidence,
  indoor,
}: {
  label: string
  confidence: number
  indoor?: boolean | null
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="brand" className="text-sm">
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M10 2l8 7h-2v7h-4v-5H8v5H4V9H2l8-7z" />
        </svg>
        {label}
      </Badge>
      {indoor !== null && indoor !== undefined && (
        <Badge tone="neutral">{indoor ? t('result.indoor') : t('result.outdoor')}</Badge>
      )}
      <span className="font-mono text-xs text-ink-400 dark:text-ink-500">{formatConfidence(confidence)}</span>
    </div>
  )
}
