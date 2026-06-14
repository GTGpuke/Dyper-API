// Page Historique : galerie des analyses (grille ou liste), recherche, filtres par type et par
// capacité, tri, groupement par date, aperçu rapide et gestion (sélection + suppression).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnalysisCard } from '../components/history/AnalysisCard'
import { AnalysisQuickLook } from '../components/history/AnalysisQuickLook'
import { AnalysisRow } from '../components/history/AnalysisRow'
import { HistoryStats } from '../components/history/HistoryStats'
import {
  type HistorySortBy,
  HistoryToolbar,
  type HistoryView,
} from '../components/history/HistoryToolbar'
import { SelectionBar } from '../components/history/SelectionBar'
import { PageContainer } from '../components/layout/PageContainer'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Skeleton } from '../components/ui/Skeleton'
import { useI18n } from '../contexts/I18nContext'
import { useAnalyses } from '../hooks/useAnalyses'
import { deleteAnalysis } from '../services/api'
import type { AnalysisRecord, AnalyzeType, SortOrder } from '../types'
import { type CapabilityId, hasCapability } from '../utils/analysisCapabilities'
import { formatNumber } from '../utils/formatters'

const VIEW_KEY = 'dyper-history-view'
const FETCH_LIMIT = 200

type GroupId = 'today' | 'week' | 'month' | 'older'
const GROUP_ORDER: GroupId[] = ['today', 'week', 'month', 'older']

// Construit la chaîne de recherche d'un enregistrement (description, scène, tags, musique).
function haystack(r: AnalysisRecord): string {
  const music = r.music?.map((m) => `${m.artist} ${m.title}`).join(' ') ?? ''
  return `${r.description} ${r.scene_label} ${r.tags.join(' ')} ${music}`.toLowerCase()
}

export function HistoryPage() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useAnalyses({
    page: 1,
    limit: FETCH_LIMIT,
    sort_by: 'created_at',
    sort_order: 'desc',
  })

  // Copie locale (permet le retrait optimiste à la suppression).
  const [items, setItems] = useState<AnalysisRecord[]>([])
  useEffect(() => {
    if (data) setItems(data.data)
  }, [data])

  // État de l'interface.
  const [search, setSearch] = useState('')
  const [type, setType] = useState<AnalyzeType | 'all'>('all')
  const [caps, setCaps] = useState<Set<CapabilityId>>(new Set())
  const [sortBy, setSortBy] = useState<HistorySortBy>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [view, setView] = useState<HistoryView>(() =>
    localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  )
  const [grouped, setGrouped] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [quickLook, setQuickLook] = useState<AnalysisRecord | null>(null)

  function changeView(v: HistoryView): void {
    localStorage.setItem(VIEW_KEY, v)
    setView(v)
  }

  function toggleCap(c: CapabilityId): void {
    setCaps((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  function toggleSelectionMode(): void {
    if (selectionMode) {
      setSelectionMode(false)
      setSelected(new Set())
    } else {
      setSelectionMode(true)
    }
  }

  function toggleSelect(id: string): void {
    setSelectionMode(true)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection(): void {
    setSelected(new Set())
    setSelectionMode(false)
  }

  // Suppression d'une seule analyse depuis l'aperçu rapide.
  function handleDeleted(id: string): void {
    setItems((prev) => prev.filter((r) => r.id !== id))
    setQuickLook(null)
    refetch()
  }

  // Suppression groupée des analyses sélectionnées (séquentielle, pour ménager la limite de débit).
  async function handleBulkDelete(): Promise<void> {
    const ids = [...selected]
    setDeleting(true)
    setDeleteError(null)
    setItems((prev) => prev.filter((r) => !selected.has(r.id)))
    setSelected(new Set())
    setSelectionMode(false)
    let failed = 0
    for (const id of ids) {
      try {
        await deleteAnalysis(id)
      } catch {
        failed += 1
      }
    }
    if (failed > 0) setDeleteError(t('history.delete.error'))
    refetch()
    setDeleting(false)
  }

  // Filtrage + tri (entièrement côté client sur le lot chargé).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const activeCaps = [...caps]
    const out = items.filter((r) => {
      if (type !== 'all' && r.type !== type) return false
      if (q && !haystack(r).includes(q)) return false
      if (activeCaps.length > 0 && !activeCaps.every((c) => hasCapability(r, c))) return false
      return true
    })
    out.sort((a, b) => {
      let v = 0
      if (sortBy === 'created_at') v = Date.parse(a.created_at) - Date.parse(b.created_at)
      else if (sortBy === 'processing_time_ms') v = a.processing_time_ms - b.processing_time_ms
      else if (sortBy === 'objects') v = a.objects_count - b.objects_count
      else v = a.type.localeCompare(b.type)
      return sortOrder === 'asc' ? v : -v
    })
    return out
  }, [items, search, type, caps, sortBy, sortOrder])

  // Groupement par date (buckets ordonnés, recalculés à la volée).
  const groups = useMemo(() => {
    if (!grouped) return null
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const t0 = startOfToday.getTime()
    const day = 86_400_000
    const buckets: Record<GroupId, AnalysisRecord[]> = { today: [], week: [], month: [], older: [] }
    for (const r of filtered) {
      const ts = Date.parse(r.created_at)
      const g: GroupId =
        ts >= t0 ? 'today' : ts >= t0 - 6 * day ? 'week' : ts >= t0 - 29 * day ? 'month' : 'older'
      buckets[g].push(r)
    }
    return GROUP_ORDER.filter((g) => buckets[g].length > 0).map((g) => ({ id: g, rows: buckets[g] }))
  }, [filtered, grouped])

  function renderList(list: AnalysisRecord[]): JSX.Element {
    if (view === 'list') {
      return (
        <div className="flex flex-col gap-2">
          {list.map((r) => (
            <AnalysisRow
              key={r.id}
              record={r}
              selectionMode={selectionMode}
              selected={selected.has(r.id)}
              onToggleSelect={toggleSelect}
              onQuickLook={setQuickLook}
            />
          ))}
        </div>
      )
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r, i) => (
          <AnalysisCard
            key={r.id}
            record={r}
            index={i}
            selectionMode={selectionMode}
            selected={selected.has(r.id)}
            onToggleSelect={toggleSelect}
            onQuickLook={setQuickLook}
          />
        ))}
      </div>
    )
  }

  const capped = Boolean(data && data.total > data.data.length)
  const hasItems = items.length > 0
  const hasResults = filtered.length > 0

  return (
    <PageContainer>
      <PageHeader
        title={t('history.title')}
        subtitle={data ? t('history.count', { n: formatNumber(data.total, lang) }) : t('history.loading')}
      />

      {error && <ErrorBanner error={error} />}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      )}

      {!loading && hasItems && (
        <div className="flex flex-col gap-5">
          <HistoryStats records={items} />

          <HistoryToolbar
            search={search}
            onSearch={setSearch}
            type={type}
            onType={(next) => setType(next)}
            caps={caps}
            onToggleCap={toggleCap}
            sortBy={sortBy}
            onSortBy={setSortBy}
            sortOrder={sortOrder}
            onToggleOrder={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
            view={view}
            onView={changeView}
            grouped={grouped}
            onToggleGroup={() => setGrouped((g) => !g)}
            selectionMode={selectionMode}
            onToggleSelectionMode={toggleSelectionMode}
          />

          {capped && (
            <p className="text-xs text-ink-400 dark:text-ink-500">{t('history.capped')}</p>
          )}
          {deleteError && <ErrorBanner error={deleteError} />}

          {!hasResults ? (
            <EmptyState title={t('history.noResults')} description={t('history.noResults.desc')} />
          ) : groups ? (
            <div className="flex flex-col gap-8">
              {groups.map((g) => (
                <section key={g.id} className="flex flex-col gap-3">
                  <h2 className="eyebrow">
                    {t(`history.group.${g.id}`)}{' '}
                    <span className="text-ink-300 dark:text-ink-600">({g.rows.length})</span>
                  </h2>
                  {renderList(g.rows)}
                </section>
              ))}
            </div>
          ) : (
            renderList(filtered)
          )}
        </div>
      )}

      {!loading && data && !hasItems && (
        <EmptyState
          title={t('history.empty.title')}
          description={t('history.empty.desc')}
          action={
            <Button onClick={() => navigate('/')} size="sm">
              {t('history.empty.cta')}
            </Button>
          }
        />
      )}

      {/* Barre d'action flottante de sélection. */}
      {selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          deleting={deleting}
          onClear={clearSelection}
          onDelete={handleBulkDelete}
        />
      )}

      <AnalysisQuickLook record={quickLook} onClose={() => setQuickLook(null)} onDeleted={handleDeleted} />
    </PageContainer>
  )
}
