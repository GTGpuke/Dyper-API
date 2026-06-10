// Carte d'une analyse persistée, affichée dans la galerie d'historique.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Badge } from '../ui/Badge'
import { useI18n } from '../../contexts/I18nContext'
import { mediaUrl } from '../../services/api'
import type { AnalysisRecord } from '../../types'
import { formatProcessingTime, formatRelative } from '../../utils/formatters'

const TYPE_TONE = { image: 'brand', video: 'amber', prompt: 'green' } as const

export function AnalysisCard({ record, index = 0 }: { record: AnalysisRecord; index?: number }) {
  const { t, lang } = useI18n()
  const [thumbFailed, setThumbFailed] = useState(false)
  const showThumb = Boolean(record.thumbnail_path) && !thumbFailed
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
    >
      <Link
        to={`/analysis/${record.id}`}
        className="surface group flex h-full flex-col gap-3 overflow-hidden p-4 transition-shadow hover:shadow-card-hover"
      >
        {showThumb && (
          <img
            src={mediaUrl(record.request_id)}
            alt={t('history.thumbnailAlt')}
            loading="lazy"
            onError={() => setThumbFailed(true)}
            className="-mx-4 -mt-4 h-32 w-[calc(100%+2rem)] max-w-none object-cover"
          />
        )}
        <div className="flex items-center justify-between">
          <Badge tone={TYPE_TONE[record.type]}>{t(`type.${record.type}`)}</Badge>
          <span className="text-xs text-ink-400 dark:text-ink-500">{formatRelative(record.created_at, lang)}</span>
        </div>

        <p className="line-clamp-3 text-sm leading-relaxed text-ink-700 dark:text-ink-200">{record.description}</p>

        {/* Aperçu des couleurs dominantes. */}
        {record.colors.length > 0 && (
          <div className="flex gap-1">
            {record.colors.slice(0, 6).map((c) => (
              <span
                key={c}
                className="h-4 flex-1 rounded ring-1 ring-inset ring-black/5"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-ink-100 pt-3 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400">
          <span className="capitalize">
            {record.scene_label} · {t('card.objects', { n: record.objects_count })}
          </span>
          <span className="font-mono text-ink-400 dark:text-ink-500">
            {formatProcessingTime(record.processing_time_ms)}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}
