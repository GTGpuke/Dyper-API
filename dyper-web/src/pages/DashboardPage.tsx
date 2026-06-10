// Page Tableau de bord : statistiques agrégées calculées depuis l'historique en base.
import { useMemo } from 'react'
import { PageContainer } from '../components/layout/PageContainer'
import { PageHeader } from '../components/layout/PageHeader'
import { StatCard } from '../components/dashboard/StatCard'
import { BarChart, type BarDatum } from '../components/dashboard/BarChart'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { TagCloud } from '../components/result/TagCloud'
import { useI18n } from '../contexts/I18nContext'
import { useAnalyses } from '../hooks/useAnalyses'
import { formatNumber, formatProcessingTime } from '../utils/formatters'

export function DashboardPage() {
  const { t, lang } = useI18n()
  // On récupère un large échantillon pour les agrégats (la passerelle plafonne à 200).
  const { data, loading, error } = useAnalyses({ page: 1, limit: 200, sort_by: 'created_at', sort_order: 'desc' })

  const stats = useMemo(() => {
    const rows = data?.data ?? []
    if (rows.length === 0) return null

    const byType = new Map<string, number>()
    const byScene = new Map<string, number>()
    const tagCount = new Map<string, number>()
    let totalObjects = 0
    let totalTime = 0

    for (const r of rows) {
      byType.set(r.type, (byType.get(r.type) ?? 0) + 1)
      byScene.set(r.scene_label, (byScene.get(r.scene_label) ?? 0) + 1)
      totalObjects += r.objects_count
      totalTime += r.processing_time_ms
      for (const t of r.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
    }

    const topEntries = (m: Map<string, number>, n: number): BarDatum[] =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }))

    return {
      count: data?.total ?? rows.length,
      sampled: rows.length,
      avgTime: totalTime / rows.length,
      totalObjects,
      typeData: [...byType.entries()].map(([label, value]) => ({ label, value })),
      sceneData: topEntries(byScene, 6),
      topTags: [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([t]) => t),
    }
  }, [data])

  return (
    <PageContainer>
      <PageHeader title={t('dash.title')} subtitle={t('dash.subtitle')} />

      {error && <ErrorBanner error={error} />}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {!loading && !stats && !error && (
        <EmptyState title={t('dash.empty.title')} description={t('dash.empty.desc')} />
      )}

      {!loading && stats && (
        <div className="flex flex-col gap-6">
          {/* Indicateurs clés. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t('dash.stat.analyses')} value={formatNumber(stats.count, lang)} hint={t('dash.stat.analysesHint')} />
            <StatCard label={t('dash.stat.objects')} value={formatNumber(stats.totalObjects, lang)} hint={t('dash.stat.objectsHint', { n: stats.sampled })} />
            <StatCard label={t('dash.stat.avgTime')} value={formatProcessingTime(stats.avgTime)} hint={t('dash.stat.avgTimeHint')} />
            <StatCard label={t('dash.stat.types')} value={stats.typeData.length} hint={t('dash.stat.typesHint')} />
          </div>

          {/* Graphes. */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="surface p-6">
              <h3 className="eyebrow mb-4">{t('dash.byType')}</h3>
              <BarChart data={stats.typeData.map((d) => ({ ...d, label: t(`type.${d.label}`) }))} />
            </div>
            <div className="surface p-6">
              <h3 className="eyebrow mb-4">{t('dash.byScene')}</h3>
              <BarChart data={stats.sceneData} />
            </div>
          </div>

          {/* Tags populaires. */}
          {stats.topTags.length > 0 && (
            <div className="surface p-6">
              <h3 className="eyebrow mb-4">{t('dash.topTags')}</h3>
              <TagCloud tags={stats.topTags} />
            </div>
          )}
        </div>
      )}
    </PageContainer>
  )
}
