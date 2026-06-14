// Carte enrichie d'une analyse dans la galerie d'historique : média (avec aperçu vidéo),
// puces de capacités, description, couleurs, scène et méta ; sélection + aperçu rapide au clic.
import { motion } from 'framer-motion'
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
  index?: number
  selectionMode: boolean
  selected: boolean
  onToggleSelect: (id: string) => void
  onQuickLook: (record: AnalysisRecord) => void
}

export function AnalysisCard({
  record,
  index = 0,
  selectionMode,
  selected,
  onToggleSelect,
  onQuickLook,
}: Props) {
  const { t, lang } = useI18n()
  const [thumbFailed, setThumbFailed] = useState(false)
  const showThumb = Boolean(record.thumbnail_path) && !thumbFailed && record.type !== 'prompt'
  const isVideo = record.type === 'video'

  function activate(): void {
    if (selectionMode) onToggleSelect(record.id)
    else onQuickLook(record)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.25) }}
    >
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
          'surface group relative flex h-full cursor-pointer flex-col gap-3 overflow-hidden p-4 text-left transition-shadow hover:shadow-card-hover',
          selected && 'ring-2 ring-brand-500'
        )}
      >
        {/* Case de sélection (révélée au survol, persistante en mode sélection ou si cochée). */}
        <SelectionCheckbox
          checked={selected}
          onToggle={() => onToggleSelect(record.id)}
          label={t('history.select')}
          variant="overlay"
          className={cn(
            'absolute left-2 top-2 z-10',
            !(selected || selectionMode) && 'opacity-0 group-hover:opacity-100'
          )}
        />

        {/* Média : miniature (overlay lecture pour les vidéos) ou bloc dégradé. */}
        <div className="-mx-4 -mt-4">
          {showThumb ? (
            <div className="relative">
              <img
                src={mediaUrl(record.request_id)}
                alt={t('history.thumbnailAlt')}
                loading="lazy"
                onError={() => setThumbFailed(true)}
                className="h-36 w-full object-cover"
              />
              {isVideo && (
                <span className="absolute inset-0 grid place-items-center bg-black/20">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-ink-900 shadow">
                    <svg className="h-5 w-5 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </span>
              )}
            </div>
          ) : (
            <div
              className={cn(
                'grid h-36 w-full place-items-center bg-gradient-to-br',
                record.type === 'prompt'
                  ? 'from-emerald-500/15 to-blue-500/15'
                  : 'from-blue-500/15 to-violet-600/20'
              )}
            >
              <svg className="h-9 w-9 text-ink-300 dark:text-ink-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {record.type === 'prompt' ? (
                  <path d="M4 5h16v10H8l-4 4V5z" />
                ) : (
                  <>
                    <rect x="3" y="4" width="18" height="14" rx="2" />
                    <path d="M3 14l5-4 4 3 3-2 6 5" />
                  </>
                )}
              </svg>
            </div>
          )}
        </div>

        {/* En-tête : type + date relative. */}
        <div className="flex items-center justify-between">
          <TypeBadge type={record.type} />
          <span className="text-xs text-ink-400 dark:text-ink-500">
            {formatRelative(record.created_at, lang)}
          </span>
        </div>

        {/* Capacités. */}
        <CapabilityBadges record={record} />

        {/* Description. */}
        <p className="line-clamp-2 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
          {record.description}
        </p>

        {/* Couleurs dominantes. */}
        {record.colors.length > 0 && (
          <div className="flex gap-1">
            {record.colors.slice(0, 6).map((c) => (
              <span
                key={c}
                className="h-3.5 flex-1 rounded ring-1 ring-inset ring-black/5"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}

        {/* Pied : scène + langue/durée. */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-100 pt-3 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400">
          <span className="truncate capitalize">{record.scene_label}</span>
          <span className="shrink-0 font-mono text-ink-400 dark:text-ink-500">
            {record.lang.toUpperCase()} · {formatProcessingTime(record.processing_time_ms)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
