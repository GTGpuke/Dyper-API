// Bloc de documentation d'un endpoint : méthode + chemin, description, paramètres,
// exemples de code (curl / JavaScript / Python) et exemple de réponse.
import { useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import { buildSamples, type ApiEndpoint, type HttpMethod } from '../../docs/apiReference'
import { Badge } from '../ui/Badge'
import { CodeBlock } from './CodeBlock'

const METHOD_TONES: Record<HttpMethod, 'green' | 'brand' | 'amber' | 'neutral'> = {
  GET: 'green',
  POST: 'brand',
  PATCH: 'amber',
  PUT: 'amber',
  DELETE: 'neutral',
}

const SAMPLE_TABS = ['curl', 'js', 'python'] as const
type SampleTab = (typeof SAMPLE_TABS)[number]

const TAB_LABELS: Record<SampleTab, string> = { curl: 'cURL', js: 'JavaScript', python: 'Python' }

const SAMPLE_TAB_KEY = 'dyper-docs-lang'

export function EndpointSection({ endpoint }: { endpoint: ApiEndpoint }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<SampleTab>(() => {
    const saved = localStorage.getItem(SAMPLE_TAB_KEY)
    return SAMPLE_TABS.includes(saved as SampleTab) ? (saved as SampleTab) : 'curl'
  })
  const samples = buildSamples(endpoint)

  function selectTab(next: SampleTab): void {
    localStorage.setItem(SAMPLE_TAB_KEY, next)
    setTab(next)
  }

  return (
    <article id={endpoint.id} className="scroll-mt-20 border-t border-ink-100 py-8 dark:border-ink-800">
      <div className="mb-2 flex flex-wrap items-center gap-2.5">
        <Badge tone={endpoint.method === 'DELETE' ? 'neutral' : METHOD_TONES[endpoint.method]}>
          <span className={cn(endpoint.method === 'DELETE' && 'text-red-600 dark:text-red-400')}>
            {endpoint.method}
          </span>
        </Badge>
        <code className="font-mono text-sm font-semibold text-ink-800 dark:text-ink-100">
          {endpoint.path}
        </code>
        {endpoint.sse && <Badge tone="amber">SSE</Badge>}
        {endpoint.auth === 'session' && <Badge tone="neutral">{t('docs.auth.cookieOnly')}</Badge>}
      </div>

      <p className="mb-4 max-w-2xl text-sm leading-relaxed text-ink-600 dark:text-ink-300">
        {t(endpoint.descKey)}
      </p>

      {endpoint.params && endpoint.params.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <p className="eyebrow mb-2">
            {endpoint.paramsKind === 'query' ? t('docs.params') : t('docs.body')}
          </p>
          <table className="w-full max-w-2xl text-left text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-xs text-ink-400 dark:border-ink-700 dark:text-ink-500">
                <th className="py-1.5 pr-4 font-medium">{t('docs.param.name')}</th>
                <th className="py-1.5 pr-4 font-medium">{t('docs.param.type')}</th>
                <th className="py-1.5 font-medium">{t('docs.param.desc')}</th>
              </tr>
            </thead>
            <tbody>
              {endpoint.params.map((param) => (
                <tr key={param.name} className="border-b border-ink-100 dark:border-ink-800">
                  <td className="py-2 pr-4 align-top">
                    <code className="font-mono text-[13px] text-ink-800 dark:text-ink-100">
                      {param.name}
                    </code>
                    {param.required && (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase text-red-500">
                        {t('docs.param.required')}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 align-top font-mono text-xs text-ink-500 dark:text-ink-400">
                    {param.type}
                  </td>
                  <td className="py-2 align-top text-ink-600 dark:text-ink-300">{t(param.descKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-1">
            {SAMPLE_TABS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => selectTab(sample)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  tab === sample
                    ? 'bg-ink-800 text-white dark:bg-ink-200 dark:text-ink-900'
                    : 'text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800'
                )}
              >
                {TAB_LABELS[sample]}
              </button>
            ))}
          </div>
          <CodeBlock code={tab === 'curl' ? samples.curl : tab === 'js' ? samples.js : samples.python} />
        </div>
        <div>
          <p className="eyebrow mb-2">{t('docs.response')}</p>
          <CodeBlock code={endpoint.responseExample} />
        </div>
      </div>
    </article>
  )
}
