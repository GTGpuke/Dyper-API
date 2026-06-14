// Ligne dense d'une analyse (vue Liste) : miniature, type, description, capacités, scène et méta ;
// sélection + aperçu rapide au clic, comme la carte mais optimisée pour le balayage rapide.
import { useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import { mediaUrl } from '../../services/api'
import type { AnalysisRecord } from '../../types'
import { formatProcessingTime, formatRelative } from '../../utils/formatters'
import { SelectionCheckbox } from '../ui/SelectionCheckbox'
import { CapabilityBadges } from './CapabilityBadges'
import { TypeBadge } from './TypeBadge'

interface Props {
  record: AnalysisRecord
  selectionMode: boolean
  selected: boolean
  onToggleSelect: (id: string) => void
  onQuickLook: (record: AnalysisRecord) => void
}

export function AnalysisRow({ record, selectionMode, selected, onToggleSelect, onQuickLook }: Props) {
  const { t, lang } = useI18n()
  const [thumbFailed, setThumbFailed] = useState(false)
  const showThumb = Boolean(record.thumbnail_path) && !thumbFailed && record.type !== 'prompt'
  const isVideo = record.type === 'video'

  function activate(): void {
    if (selectionMode) onToggleSelect(record.id)
    else onQuickLook(record)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
      className={cn(
        'surface group flex cursor-pointer items-center gap-3 p-3 transition-shadow hover:shadow-card-hover',
        selected && 'ring-2 ring-brand-500'
      )}
    >
      {/* Case de sélection. */}
      <SelectionCheckbox
        checked={selected}
        onToggle={() => onToggleSelect(record.id)}
        label={t('history.select')}
        className={cn(!(selected || selectionMode) && 'opacity-0 group-hover:opacity-100')}
      />

      {/* Miniature. */}
      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-100 dark:bg-ink-800">
        {showThumb ? (
          <img
            src={mediaUrl(record.request_id)}
            alt={t('history.thumbnailAlt')}
            loading="lazy"
            onError={() => setThumbFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-ink-300 dark:text-ink-600">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {record.type === 'prompt' ? (
                <path d="M4 5h16v10H8l-4 4V5z" />
              ) : (
                <rect x="3" y="4" width="18" height="16" rx="2" />
              )}
            </svg>
          </span>
        )}
        {isVideo && showThumb && (
          <span className="absolute inset-0 grid place-items-center bg-black/20">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        )}
      </div>

      {/* Contenu principal. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <TypeBadge type={record.type} size="sm" />
          <p className="truncate text-sm text-ink-800 dark:text-ink-100">{record.description}</p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <CapabilityBadges record={record} compact />
          <span className="truncate text-xs capitalize text-ink-400 dark:text-ink-500">
            {record.scene_label}
          </span>
        </div>
      </div>

      {/* Méta (masquée sur très petits écrans). */}
      <div className="hidden shrink-0 flex-col items-end gap-0.5 text-xs text-ink-400 dark:text-ink-500 sm:flex">
        <span>{formatRelative(record.created_at, lang)}</span>
        <span className="font-mono">
          {record.lang.toUpperCase()} · {formatProcessingTime(record.processing_time_ms)}
        </span>
      </div>
    </div>
  )
}
