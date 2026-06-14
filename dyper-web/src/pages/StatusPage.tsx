// Page « Statut » : disponibilité des services Dyper, façon page de statut publique.
// Statut global live, cartes par service et frise de disponibilité sur une fenêtre choisie
// (1 h à 1 an), alimentée par l'historique réel des relevés (aucune donnée inventée).
import { useMemo, useState } from 'react'
import { PageContainer } from '../components/layout/PageContainer'
import { PageHeader } from '../components/layout/PageHeader'
import { Segmented } from '../components/ui/Segmented'
import { useI18n } from '../contexts/I18nContext'
import { useHealth, useHealthHistory } from '../hooks/useHealth'
import { cn } from '../lib/cn'
import type { HealthSample } from '../services/healthStore'
import type { HealthStatus } from '../types'

const BUCKETS = 60

// Fenêtres de la frise (en millisecondes), du plus court au plus long.
const RANGES = {
  '1h': 3_600_000,
  '6h': 21_600_000,
  '24h': 86_400_000,
  '1w': 604_800_000,
  '1mo': 2_592_000_000,
  '1y': 31_536_000_000,
} as const
type RangeId = keyof typeof RANGES
const RANGE_ORDER: RangeId[] = ['1h', '6h', '24h', '1w', '1mo', '1y']

type Cell = 'ok' | 'partial' | 'down' | 'none'
type Level = 'ok' | 'partial' | 'down' | 'unknown'

// Statut global déduit du relevé live : base KO = interruption, IA seule KO = dégradation.
function levelOf(h: HealthStatus | null): Level {
  if (!h) return 'unknown'
  if (h.status !== 'ok' || h.db !== 'ok') return 'down'
  if (h.ai !== 'ok') return 'partial'
  return 'ok'
}

// Agrège l'historique d'un service en BUCKETS segments sur la fenêtre [now - rangeMs, now].
function computeCells(
  history: HealthSample[],
  rangeMs: number,
  now: number,
  pick: (s: HealthSample) => boolean
): Cell[] {
  const bucketMs = rangeMs / BUCKETS
  const start = now - rangeMs
  const agg = Array.from({ length: BUCKETS }, () => ({ ok: 0, down: 0 }))
  for (const s of history) {
    if (s.t < start || s.t > now) continue
    const i = Math.min(BUCKETS - 1, Math.floor((s.t - start) / bucketMs))
    if (pick(s)) agg[i].ok += 1
    else agg[i].down += 1
  }
  return agg.map(({ ok, down }) => {
    if (ok + down === 0) return 'none'
    if (down === 0) return 'ok'
    if (ok === 0) return 'down'
    return 'partial'
  })
}

// Disponibilité (%) sur la fenêtre, au prorata des relevés (null si aucun relevé).
function uptimePct(
  history: HealthSample[],
  rangeMs: number,
  now: number,
  pick: (s: HealthSample) => boolean
): number | null {
  const start = now - rangeMs
  let ok = 0
  let total = 0
  for (const s of history) {
    if (s.t < start || s.t > now) continue
    total += 1
    if (pick(s)) ok += 1
  }
  return total === 0 ? null : (ok / total) * 100
}

// Formate une durée de fonctionnement (secondes) en « j h min ».
function formatUptime(seconds: number, lang: 'fr' | 'en'): string {
  const d = Math.floor(seconds / 86_400)
  const h = Math.floor((seconds % 86_400) / 3_600)
  const m = Math.floor((seconds % 3_600) / 60)
  const u = lang === 'fr' ? { d: 'j', h: 'h', m: 'min' } : { d: 'd', h: 'h', m: 'm' }
  const parts: string[] = []
  if (d > 0) parts.push(`${d} ${u.d}`)
  if (h > 0) parts.push(`${h} ${u.h}`)
  parts.push(`${m} ${u.m}`)
  return parts.join(' ')
}

const CELL_CLASS: Record<Cell, string> = {
  ok: 'bg-emerald-500',
  partial: 'bg-amber-400',
  down: 'bg-red-500',
  none: 'bg-ink-200 dark:bg-ink-700',
}

const HEAD: Record<Level, { key: string; dot: string; box: string }> = {
  ok: {
    key: 'health.allOperational',
    dot: 'bg-emerald-500',
    box: 'border-emerald-500/30 bg-emerald-500/5',
  },
  partial: {
    key: 'health.partialOutage',
    dot: 'bg-amber-400',
    box: 'border-amber-400/30 bg-amber-400/5',
  },
  down: { key: 'health.majorOutage', dot: 'bg-red-500', box: 'border-red-500/30 bg-red-500/5' },
  unknown: {
    key: 'health.checking',
    dot: 'bg-ink-300 dark:bg-ink-600',
    box: 'border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800/40',
  },
}

// Pastille de statut courant d'un service (vert opérationnel, rouge indisponible, gris inconnu).
function StatusPill({ live }: { live: boolean | null }) {
  const { t } = useI18n()
  const label =
    live === null
      ? t('health.status.unknown')
      : live
        ? t('health.status.operational')
        : t('health.status.down')
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 text-sm font-medium',
        live === null
          ? 'text-ink-400'
          : live
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400'
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          live === null ? 'bg-ink-300 dark:bg-ink-600' : live ? 'bg-emerald-500' : 'bg-red-500'
        )}
      />
      {label}
    </span>
  )
}

// Frise de disponibilité : BUCKETS segments verticaux colorés selon le statut agrégé.
function Frieze({ cells, labels }: { cells: Cell[]; labels: Record<Cell, string> }) {
  return (
    <div className="flex items-end gap-[2px]">
      {cells.map((cell, i) => (
        <span
          // Frise statique d'ordre fixe : la clé par index est stable et adaptée.
          key={i}
          title={labels[cell]}
          className={cn('h-9 flex-1 rounded-[2px]', CELL_CLASS[cell])}
        />
      ))}
    </div>
  )
}

export function StatusPage() {
  const { t, lang } = useI18n()
  const health = useHealth()
  const history = useHealthHistory()
  const [range, setRange] = useState<RangeId>('24h')

  const level = levelOf(health)

  const cellLabels: Record<Cell, string> = {
    ok: t('health.status.operational'),
    partial: t('health.status.partial'),
    down: t('health.status.down'),
    none: t('health.noData'),
  }

  const services = useMemo(() => {
    const now = Date.now()
    const rangeMs = RANGES[range]
    const defs = [
      {
        id: 'gateway',
        name: t('health.svc.gateway'),
        desc: t('health.svc.gatewayDesc'),
        pick: (s: HealthSample) => s.db,
        live: health ? health.db === 'ok' : null,
      },
      {
        id: 'ai',
        name: t('health.svc.ai'),
        desc: t('health.svc.aiDesc'),
        pick: (s: HealthSample) => s.ai,
        live: health ? health.ai === 'ok' : null,
      },
    ]
    return defs.map((d) => ({
      ...d,
      cells: computeCells(history, rangeMs, now, d.pick),
      pct: uptimePct(history, rangeMs, now, d.pick),
    }))
  }, [history, range, health, t])

  return (
    <PageContainer>
      <PageHeader
        title={t('health.page.title')}
        subtitle={t('health.page.subtitle')}
        actions={
          <div className="max-w-full overflow-x-auto">
            <Segmented
              value={range}
              onChange={setRange}
              options={RANGE_ORDER.map((id) => ({ value: id, label: t(`health.range.${id}`) }))}
            />
          </div>
        }
      />

      {/* Bannière de statut global (live). */}
      <div className={cn('mb-6 flex items-center gap-3 rounded-2xl border p-5', HEAD[level].box)}>
        <span className="relative flex h-3 w-3">
          {level === 'ok' && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
          )}
          <span className={cn('relative inline-flex h-3 w-3 rounded-full', HEAD[level].dot)} />
        </span>
        <div>
          <p className="text-lg font-semibold text-ink-900 dark:text-ink-50">{t(HEAD[level].key)}</p>
          {health && (
            <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
              {t('health.uptime', { value: formatUptime(health.uptime, lang) })}
            </p>
          )}
        </div>
      </div>

      {/* Cartes par service avec frise de disponibilité. */}
      <div className="flex flex-col gap-4">
        {services.map((svc) => (
          <div key={svc.id} className="surface p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-ink-900 dark:text-ink-50">{svc.name}</h2>
                <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{svc.desc}</p>
              </div>
              <StatusPill live={svc.live} />
            </div>
            <Frieze cells={svc.cells} labels={cellLabels} />
            <div className="mt-2 flex items-center justify-between text-xs text-ink-400 dark:text-ink-500">
              <span>{t('health.ago', { range: t(`health.range.${range}`) })}</span>
              <span className="font-medium">
                {svc.pct === null
                  ? t('health.noData')
                  : t('health.uptimeOnWindow', { pct: svc.pct.toFixed(2) })}
              </span>
              <span>{t('health.now')}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Légende des couleurs de la frise. */}
      <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-ink-400 dark:text-ink-500">
        {(['ok', 'partial', 'down', 'none'] as Cell[]).map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-[2px]', CELL_CLASS[c])} />
            {cellLabels[c]}
          </span>
        ))}
      </div>
    </PageContainer>
  )
}
