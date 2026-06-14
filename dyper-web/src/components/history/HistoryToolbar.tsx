// Barre d'outils de l'historique : recherche plein texte, filtre par type, puces de capacités
// cumulables, tri + ordre, bascule de vue (grille/liste), groupement par date et mode sélection.
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { AnalyzeType, SortOrder } from '../../types'
import type { CapabilityId } from '../../utils/analysisCapabilities'
import { Dropdown } from '../ui/Dropdown'
import { Segmented } from '../ui/Segmented'

export type HistorySortBy = 'created_at' | 'processing_time_ms' | 'type' | 'objects'
export type HistoryView = 'grid' | 'list'

const TYPES: { id: AnalyzeType | 'all'; key: string }[] = [
  { id: 'all', key: 'history.filter.all' },
  { id: 'image', key: 'history.filter.image' },
  { id: 'video', key: 'history.filter.video' },
  { id: 'prompt', key: 'history.filter.prompt' },
]

const CAPS: { id: CapabilityId; key: string }[] = [
  { id: 'video', key: 'history.cap.video' },
  { id: 'transcript', key: 'history.cap.transcript' },
  { id: 'music', key: 'history.cap.music' },
  { id: 'objects', key: 'history.cap.objects' },
]

const SORTS: { id: HistorySortBy; key: string }[] = [
  { id: 'created_at', key: 'history.sort.created_at' },
  { id: 'processing_time_ms', key: 'history.sort.processing_time_ms' },
  { id: 'type', key: 'history.sort.type' },
  { id: 'objects', key: 'history.sort.objects' },
]

interface Props {
  search: string
  onSearch: (v: string) => void
  type: AnalyzeType | 'all'
  onType: (t: AnalyzeType | 'all') => void
  caps: Set<CapabilityId>
  onToggleCap: (c: CapabilityId) => void
  sortBy: HistorySortBy
  onSortBy: (s: HistorySortBy) => void
  sortOrder: SortOrder
  onToggleOrder: () => void
  view: HistoryView
  onView: (v: HistoryView) => void
  grouped: boolean
  onToggleGroup: () => void
  selectionMode: boolean
  onToggleSelectionMode: () => void
}

export function HistoryToolbar({
  search,
  onSearch,
  type,
  onType,
  caps,
  onToggleCap,
  sortBy,
  onSortBy,
  sortOrder,
  onToggleOrder,
  view,
  onView,
  grouped,
  onToggleGroup,
  selectionMode,
  onToggleSelectionMode,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-3">
      {/* Ligne 1 : recherche + vue + sélection. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t('history.search')}
            className="w-full rounded-xl border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:shadow-focus dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50"
          />
        </div>

        <Segmented
          value={view}
          onChange={onView}
          options={[
            { value: 'grid', label: t('history.view.grid') },
            { value: 'list', label: t('history.view.list') },
          ]}
        />

        <button
          type="button"
          onClick={onToggleSelectionMode}
          aria-pressed={selectionMode}
          className={cn(
            'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
            selectionMode
              ? 'border-brand-400 bg-brand-500/10 text-brand-700 dark:text-brand-300'
              : 'border-ink-200 text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800'
          )}
        >
          {selectionMode ? t('common.cancel') : t('history.select')}
        </button>
      </div>

      {/* Ligne 2 : type + capacités + tri. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="inline-flex rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
          {TYPES.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onType(tab.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                type === tab.id
                  ? 'bg-white text-ink-800 shadow-sm dark:bg-ink-600 dark:text-ink-50'
                  : 'text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200'
              )}
            >
              {t(tab.key)}
            </button>
          ))}
        </div>

        {/* Puces de capacités cumulables. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CAPS.map((c) => {
            const active = caps.has(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onToggleCap(c.id)}
                aria-pressed={active}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-brand-400 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                    : 'border-ink-200 text-ink-500 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800'
                )}
              >
                {t(c.key)}
              </button>
            )
          })}
        </div>

        {/* Tri + ordre + groupement. */}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={onToggleGroup}
            aria-pressed={grouped}
            className={cn(
              'rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors',
              grouped
                ? 'border-brand-400 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                : 'border-ink-200 text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800'
            )}
          >
            {t('history.group')}
          </button>
          <Dropdown
            value={sortBy}
            onChange={onSortBy}
            ariaLabel={t('history.sortBy')}
            options={SORTS.map((s) => ({ value: s.id, label: t(s.key) }))}
          />
          <button
            type="button"
            onClick={onToggleOrder}
            className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 bg-white text-ink-500 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
            aria-label={t('history.order')}
            title={sortOrder === 'asc' ? t('history.asc') : t('history.desc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>
    </div>
  )
}
