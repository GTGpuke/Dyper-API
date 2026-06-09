// Barre de filtres / tri de l'historique des analyses.
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { AnalysesQuery, AnalyzeType, SortBy } from '../../types'

const TYPES: { id: AnalyzeType | 'all'; key: string }[] = [
  { id: 'all', key: 'history.filter.all' },
  { id: 'image', key: 'history.filter.image' },
  { id: 'video', key: 'history.filter.video' },
  { id: 'prompt', key: 'history.filter.prompt' },
]

const SORTS: { id: SortBy; key: string }[] = [
  { id: 'created_at', key: 'history.sort.created_at' },
  { id: 'processing_time_ms', key: 'history.sort.processing_time_ms' },
  { id: 'type', key: 'history.sort.type' },
]

interface Props {
  query: AnalysesQuery
  onChange: (next: AnalysesQuery) => void
}

export function HistoryFilters({ query, onChange }: Props) {
  const { t } = useI18n()
  const activeType = query.type ?? 'all'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Filtre par type. */}
      <div className="inline-flex rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
        {TYPES.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() =>
              onChange({ ...query, page: 1, type: tab.id === 'all' ? undefined : tab.id })
            }
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              activeType === tab.id
                ? 'bg-white text-ink-800 shadow-sm dark:bg-ink-600 dark:text-ink-50'
                : 'text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200'
            )}
          >
            {t(tab.key)}
          </button>
        ))}
      </div>

      {/* Tri. */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-ink-400 dark:text-ink-500">{t('history.sortBy')}</span>
        <select
          value={query.sort_by ?? 'created_at'}
          onChange={(e) => onChange({ ...query, sort_by: e.target.value as SortBy })}
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-400 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {t(s.key)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() =>
            onChange({ ...query, sort_order: query.sort_order === 'asc' ? 'desc' : 'asc' })
          }
          className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 bg-white text-ink-500 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
          aria-label={t('history.order')}
          title={query.sort_order === 'asc' ? t('history.asc') : t('history.desc')}
        >
          {query.sort_order === 'asc' ? '↑' : '↓'}
        </button>
      </div>
    </div>
  )
}
