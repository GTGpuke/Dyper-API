// Bloc de documentation d'un endpoint, façon platform.claude.com : en-tête méthode + chemin
// avec lien d'ancre copiable, paramètres en lignes de définition à gauche, panneaux de code
// épinglés à droite (requête en 3 langages, réponse 200 / erreur) et testeur live sur les GET sûrs.
import { useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import { buildSamples, type ApiEndpoint, type HttpMethod } from '../../docs/apiReference'
import { Badge } from '../ui/Badge'
import { CodeBlock } from './CodeBlock'
import { TryIt } from './TryIt'

const METHOD_TONES: Record<HttpMethod, 'green' | 'brand' | 'amber' | 'neutral'> = {
  GET: 'green',
  POST: 'brand',
  PATCH: 'amber',
  PUT: 'amber',
  DELETE: 'neutral',
}

const SAMPLE_TABS = [
  { id: 'curl', label: 'cURL' },
  { id: 'js', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
] as const
type SampleTab = (typeof SAMPLE_TABS)[number]['id']

const SAMPLE_TAB_KEY = 'dyper-docs-lang'

// Endpoints GET sans paramètre de chemin, exécutables sans risque depuis le navigateur.
const TRYABLE_PATHS: Record<string, string> = {
  health: '/health',
  getMe: '/api/v1/me',
  listAnalyses: '/api/v1/analyses?page=1&limit=3',
  listConversations: '/api/v1/conversations',
  getPlan: '/api/v1/me/plan',
  getUsage: '/api/v1/me/usage',
  getCapacity: '/api/v1/me/capacity',
}

interface ErrorExample {
  status: number
  body: string
}

/**
 * Exemple d'erreur représentatif de l'endpoint, fidèle à l'enveloppe réelle de la passerelle
 * ({ success: false, requestId, error: { code, message, details } }, messages en français).
 */
function buildErrorExample(endpoint: ApiEndpoint): ErrorExample | null {
  if (endpoint.auth === 'none') return null
  const unauthorized =
    endpoint.auth === 'session' ||
    endpoint.auth === 'appKey+session' ||
    endpoint.auth === 'apiKey'
  return {
    status: unauthorized ? 401 : 400,
    body: JSON.stringify(
      {
        success: false,
        requestId: 'uuid',
        error: unauthorized
          ? { code: 'UNAUTHORIZED', message: 'Authentification requise ou identifiants invalides.', details: {} }
          : { code: 'VALIDATION_ERROR', message: 'Les données fournies sont invalides.', details: {} },
      },
      null,
      2
    ),
  }
}

export function EndpointSection({ endpoint }: { endpoint: ApiEndpoint }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<SampleTab>(() => {
    const saved = localStorage.getItem(SAMPLE_TAB_KEY)
    return SAMPLE_TABS.some((s) => s.id === saved) ? (saved as SampleTab) : 'curl'
  })
  const [responseTab, setResponseTab] = useState('200')
  const [linkCopied, setLinkCopied] = useState(false)
  const samples = buildSamples(endpoint)
  const errorExample = buildErrorExample(endpoint)
  const tryPath = TRYABLE_PATHS[endpoint.id]

  function selectTab(next: string): void {
    localStorage.setItem(SAMPLE_TAB_KEY, next)
    setTab(next as SampleTab)
  }

  // Copie l'URL directe de l'endpoint (page de référence + ancre).
  function copyAnchor(): void {
    const url = `${window.location.origin}${window.location.pathname}#ep-${endpoint.id}`
    navigator.clipboard?.writeText(url).then(
      () => {
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 1500)
      },
      () => undefined
    )
  }

  return (
    <article id={endpoint.id} className="scroll-mt-20 border-t border-ink-100 py-10 dark:border-ink-800">
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
        {endpoint.auth === 'apiKey' && <Badge tone="brand">{t('docs.auth.apiKeyBadge')}</Badge>}
        <button
          type="button"
          onClick={copyAnchor}
          title={t('docs.copyLink')}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-600 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-300"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
            <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
          </svg>
          {linkCopied ? t('docs.linkCopied') : t('docs.copyLink')}
        </button>
      </div>

      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-ink-600 dark:text-ink-300">
        {t(endpoint.descKey)}
      </p>

      <div className="grid items-start gap-8 xl:grid-cols-2">
        {/* Paramètres en lignes de définition. */}
        <div>
          {endpoint.params && endpoint.params.length > 0 ? (
            <>
              <p className="eyebrow mb-1">
                {endpoint.paramsKind === 'query' ? t('docs.params') : t('docs.body')}
              </p>
              <div className="divide-y divide-ink-100 border-t border-ink-100 dark:divide-ink-800 dark:border-ink-800">
                {endpoint.params.map((param) => (
                  <div key={param.name} className="py-3">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <code className="font-mono text-[13px] font-semibold text-ink-900 dark:text-ink-50">
                        {param.name}
                      </code>
                      <span className="font-mono text-xs text-ink-400 dark:text-ink-500">
                        {param.type}
                      </span>
                      {param.required && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-red-500">
                          {t('docs.param.required')}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
                      {t(param.descKey)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-400 dark:text-ink-500">{t('docs.noParams')}</p>
          )}
        </div>

        {/* Panneaux de code épinglés : requête, réponse, testeur. */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-2">
          <CodeBlock
            title={t('docs.request')}
            tabs={[...SAMPLE_TABS]}
            activeTab={tab}
            onTabSelect={selectTab}
            code={tab === 'curl' ? samples.curl : tab === 'js' ? samples.js : samples.python}
          />
          <CodeBlock
            title={t('docs.response')}
            tabs={
              errorExample
                ? [
                    { id: '200', label: '200' },
                    { id: 'error', label: String(errorExample.status) },
                  ]
                : undefined
            }
            activeTab={errorExample ? responseTab : undefined}
            onTabSelect={errorExample ? setResponseTab : undefined}
            code={
              errorExample && responseTab === 'error' ? errorExample.body : endpoint.responseExample
            }
          />
          {tryPath && <TryIt path={tryPath} />}
        </div>
      </div>
    </article>
  )
}
