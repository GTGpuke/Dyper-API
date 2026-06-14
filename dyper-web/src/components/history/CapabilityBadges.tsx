// Puces de capacités d'une analyse (chapitres, transcription, musique, objets), partagées
// par la carte (mode étiqueté) et la ligne de liste (mode compact, icône seule).
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { AnalysisRecord } from '../../types'
import { getCapabilities } from '../../utils/analysisCapabilities'

// Icônes (tracés SVG simples et reconnaissables).
const ICON: Record<string, string> = {
  transcript: 'M4 5h16v9H9l-4 4v-4H4z',
  music: 'M9 17V6l11-2v9',
  objects: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3',
}

function Chip({
  icon,
  label,
  compact,
  title,
}: {
  icon: string
  label: string
  compact: boolean
  title: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-ink-100 font-medium text-ink-600 dark:bg-ink-800 dark:text-ink-300',
        compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'
      )}
    >
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      {!compact && <span className="truncate">{label}</span>}
    </span>
  )
}

export function CapabilityBadges({
  record,
  compact = false,
  className,
}: {
  record: AnalysisRecord
  compact?: boolean
  className?: string
}) {
  const { t } = useI18n()
  const caps = getCapabilities(record)

  if (!caps.hasTranscript && !caps.hasMusic && caps.objectsCount === 0) {
    return null
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {caps.hasTranscript && (
        <Chip
          icon={ICON.transcript}
          compact={compact}
          title={t('history.cap.transcript')}
          label={t('history.cap.transcript')}
        />
      )}
      {caps.hasMusic && record.music && record.music.length > 0 && (
        <Chip
          icon={ICON.music}
          compact={compact}
          title={t('history.cap.music')}
          label={`${record.music[0].artist} – ${record.music[0].title}`}
        />
      )}
      {caps.objectsCount > 0 && (
        <Chip
          icon={ICON.objects}
          compact={compact}
          title={t('history.cap.objects')}
          label={t('card.objects', { n: caps.objectsCount })}
        />
      )}
    </div>
  )
}
