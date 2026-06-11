// Testeur live d'un endpoint GET : exécute la requête depuis le navigateur (clé applicative
// du front + session courante) et affiche le statut HTTP réel avec le corps de la réponse.
import { useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import { probe } from '../../services/api'

interface ProbeResult {
  status: number
  body: unknown
}

/** Teinte du badge de statut : vert en succès, ambre en erreur client, rouge sinon. */
function statusClasses(status: number): string {
  if (status >= 200 && status < 300) {
    return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  }
  if (status >= 400 && status < 500) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  return 'bg-red-500/15 text-red-600 dark:text-red-400'
}

export function TryIt({ path }: { path: string }) {
  const { t } = useI18n()
  const [result, setResult] = useState<ProbeResult | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(): Promise<void> {
    setBusy(true)
    setResult(await probe(path))
    setBusy(false)
  }

  return (
    <div className="rounded-xl border border-ink-200 p-3.5 dark:border-ink-700">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{t('docs.tryIt')}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-400 dark:text-ink-500">
            {t('docs.tryIt.note')}
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="shrink-0 rounded-lg bg-gradient-to-r from-blue-500 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
        >
          {busy ? t('docs.tryIt.running') : t('docs.tryIt.run')}
        </button>
      </div>

      {result && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-md px-2 py-0.5 font-mono text-xs font-semibold',
                statusClasses(result.status)
              )}
            >
              {result.status > 0 ? result.status : t('docs.tryIt.network')}
            </span>
            <code className="truncate font-mono text-xs text-ink-400 dark:text-ink-500">
              GET {path}
            </code>
          </div>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-ink-900 p-3 font-mono text-xs leading-relaxed text-ink-100">
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
