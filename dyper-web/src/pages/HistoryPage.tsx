// Page Historique : galerie paginée des analyses persistées en base SQLite.
import { useState } from 'react'
import { PageContainer } from '../components/layout/PageContainer'
import { PageHeader } from '../components/layout/PageHeader'
import { HistoryFilters } from '../components/history/HistoryFilters'
import { AnalysisCard } from '../components/history/AnalysisCard'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Button } from '../components/ui/Button'
import { useAnalyses } from '../hooks/useAnalyses'
import { useI18n } from '../contexts/I18nContext'
import type { AnalysesQuery } from '../types'
import { formatNumber } from '../utils/formatters'

const LIMIT = 12

export function HistoryPage() {
  const { t, lang } = useI18n()
  const [query, setQuery] = useState<AnalysesQuery>({
    page: 1,
    limit: LIMIT,
    sort_by: 'created_at',
    sort_order: 'desc',
  })
  const { data, loading, error } = useAnalyses(query)

  const page = query.page ?? 1
  const totalPages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1

  return (
    <PageContainer>
      <PageHeader
        title={t('history.title')}
        subtitle={
          data ? t('history.count', { n: formatNumber(data.total, lang) }) : t('history.loading')
        }
      />

      <div className="mb-6">
        <HistoryFilters query={query} onChange={setQuery} />
      </div>

      {error && <ErrorBanner error={error} />}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      )}

      {!loading && data && data.data.length === 0 && (
        <EmptyState
          title={t('history.empty.title')}
          description={t('history.empty.desc')}
          action={
            <Button onClick={() => (window.location.href = '/')} size="sm">
              {t('history.empty.cta')}
            </Button>
          }
        />
      )}

      {!loading && data && data.data.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((record, i) => (
              <AnalysisCard key={record.id} record={record} index={i} />
            ))}
          </div>

          {/* Pagination. */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setQuery({ ...query, page: page - 1 })}
              >
                {t('history.prev')}
              </Button>
              <span className="text-sm text-ink-500 dark:text-ink-400">
                {t('history.page', { page, total: totalPages })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setQuery({ ...query, page: page + 1 })}
              >
                {t('history.next')}
              </Button>
            </div>
          )}
        </>
      )}
    </PageContainer>
  )
}
