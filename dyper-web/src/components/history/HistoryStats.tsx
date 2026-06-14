// Ruban de synthèse de l'historique : métriques compactes calculées depuis les analyses chargées.
import { useMemo } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import type { AnalysisRecord } from '../../types'
import { formatNumber, formatProcessingTime } from '../../utils/formatters'

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface flex flex-col gap-0.5 px-4 py-3">
      <span className="eyebrow">{label}</span>
      <span className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">{value}</span>
    </div>
  )
}

export function HistoryStats({ records }: { records: AnalysisRecord[] }) {
  const { t, lang } = useI18n()

  const stats = useMemo(() => {
    let images = 0
    let videos = 0
    let prompts = 0
    let totalObjects = 0
    let totalTime = 0
    for (const r of records) {
      if (r.type === 'image') images += 1
      else if (r.type === 'video') videos += 1
      else prompts += 1
      totalObjects += r.objects_count
      totalTime += r.processing_time_ms
    }
    return {
      total: records.length,
      images,
      videos,
      prompts,
      totalObjects,
      avgTime: records.length > 0 ? totalTime / records.length : 0,
    }
  }, [records])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Tile label={t('history.stats.total')} value={formatNumber(stats.total, lang)} />
      <Tile label={t('history.stats.images')} value={formatNumber(stats.images, lang)} />
      <Tile label={t('history.stats.videos')} value={formatNumber(stats.videos, lang)} />
      <Tile label={t('history.stats.prompts')} value={formatNumber(stats.prompts, lang)} />
      <Tile label={t('history.stats.objects')} value={formatNumber(stats.totalObjects, lang)} />
      <Tile label={t('history.stats.avgTime')} value={formatProcessingTime(stats.avgTime)} />
    </div>
  )
}
