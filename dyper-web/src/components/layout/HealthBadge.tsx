// Indicateur de santé live : état de la base SQLite et du service dyper-ai.
import { useI18n } from '../../contexts/I18nContext'
import { useHealth } from '../../hooks/useHealth'
import { cn } from '../../lib/cn'

function Dot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
      <span
        className={cn('h-2 w-2 rounded-full', ok ? 'bg-emerald-500' : 'bg-red-500')}
        style={ok ? { boxShadow: '0 0 0 3px rgb(16 185 129 / 0.15)' } : undefined}
      />
      {label}
    </span>
  )
}

export function HealthBadge() {
  const health = useHealth()
  const { t } = useI18n()

  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-800/60">
      <Dot ok={health?.db === 'ok'} label={t('health.db')} />
      <span className="h-3 w-px bg-ink-200 dark:bg-ink-700" />
      <Dot ok={health?.ai === 'ok'} label={t('health.ai')} />
    </div>
  )
}
