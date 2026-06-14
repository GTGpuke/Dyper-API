// Page « Global » : feed public des analyses publiées (tri populaire / récent / top).
// Remplace l'ancien tableau de bord.
import { useCallback, useEffect, useState } from 'react'
import { PublicationCard } from '../components/global/PublicationCard'
import { PageContainer } from '../components/layout/PageContainer'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Segmented } from '../components/ui/Segmented'
import { Skeleton } from '../components/ui/Skeleton'
import { useI18n } from '../contexts/I18nContext'
import { getGlobalFeed } from '../services/api'
import type { ApiError, FeedSort, Publication } from '../types'

export function GlobalPage() {
  const { t } = useI18n()
  const [sort, setSort] = useState<FeedSort>('hot')
  const [items, setItems] = useState<Publication[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | string | null>(null)

  const load = useCallback(async (nextSort: FeedSort, nextPage: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getGlobalFeed(nextSort, nextPage)
      setTotal(res.total)
      setItems((prev) => (nextPage === 1 ? res.data : [...prev, ...res.data]))
    } catch (e) {
      setError(e as ApiError)
    } finally {
      setLoading(false)
    }
  }, [])

  // Recharge depuis la première page à chaque changement de tri.
  useEffect(() => {
    setPage(1)
    load(sort, 1)
  }, [sort, load])

  const hasMore = items.length < total

  return (
    <PageContainer>
      <PageHeader
        title={t('global.title')}
        subtitle={t('global.subtitle')}
        actions={
          <Segmented
            value={sort}
            onChange={setSort}
            options={[
              { value: 'hot', label: t('global.sort.hot') },
              { value: 'new', label: t('global.sort.new') },
              { value: 'top', label: t('global.sort.top') },
            ]}
          />
        }
      />

      {error && <ErrorBanner error={error} />}

      {loading && items.length === 0 && (
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <EmptyState title={t('global.empty.title')} description={t('global.empty.desc')} />
      )}

      {items.length > 0 && (
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {items.map((publication) => (
            <PublicationCard key={publication.id} publication={publication} />
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                loading={loading}
                onClick={() => {
                  const next = page + 1
                  setPage(next)
                  load(sort, next)
                }}
              >
                {t('global.loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  )
}
