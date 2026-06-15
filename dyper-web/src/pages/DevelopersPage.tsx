// Console développeur (dans la documentation API), scindée en deux onglets :
//  - « Clés & statistiques » : consommation, solde de tokens, génération/listing/révocation de clés.
//  - « Abonnement » : forfaits API (4 offres dont une illimitée) + achat de packs de tokens, via une
//    page de paiement dédiée et distincte de celle du site.
// Publique comme le reste des docs : invite à se connecter si aucune session.
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CancelSubscriptionModal } from '../components/billing/CancelSubscriptionModal'
import { ApiCheckoutModal, type ApiPurchase } from '../components/developers/ApiCheckoutModal'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import { cn } from '../lib/cn'
import * as api from '../services/api'
import type { ApiKey, ApiKeyCreated, ApiPlanId, ApiTokenPackId, ApiUsageView } from '../types'

interface ApiPlanDef {
  id: ApiPlanId
  name: string
  priceEur: number
  monthlyRequests: number
  rate: number
  featured?: boolean
}

const API_PLANS: ApiPlanDef[] = [
  { id: 'free', name: 'Free', priceEur: 0, monthlyRequests: 100, rate: 10 },
  { id: 'starter', name: 'Starter', priceEur: 19, monthlyRequests: 5000, rate: 60, featured: true },
  { id: 'business', name: 'Business', priceEur: 99, monthlyRequests: 50000, rate: 300 },
  { id: 'unlimited', name: 'Unlimited', priceEur: 499, monthlyRequests: -1, rate: 1000 },
]

interface TokenPackDef {
  id: ApiTokenPackId
  tokens: number
  priceEur: number
}

const TOKEN_PACKS: TokenPackDef[] = [
  { id: 'small', tokens: 1000, priceEur: 9 },
  { id: 'medium', tokens: 10000, priceEur: 79 },
  { id: 'large', tokens: 50000, priceEur: 299 },
]

export function DevelopersPage() {
  const { t, lang } = useI18n()
  const { user, refresh } = useAuth()
  // On arrive sur « Clés & statistiques » ; l'onglet « Abonnement » reste visuellement mis en avant.
  const [tab, setTab] = useState<'keys' | 'billing'>('keys')
  const [usage, setUsage] = useState<ApiUsageView | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [createdSecret, setCreatedSecret] = useState<ApiKeyCreated | null>(null)
  const [copied, setCopied] = useState(false)
  const [purchase, setPurchase] = useState<ApiPurchase | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  const currentPlan: ApiPlanId = user?.apiPlan ?? 'free'

  const reload = useCallback(async () => {
    if (!user) return
    const [u, k] = await Promise.all([api.getApiUsage(), api.listApiKeys()])
    setUsage(u)
    setKeys(k)
  }, [user])

  useEffect(() => {
    void reload().catch(() => undefined)
  }, [reload])

  async function create(): Promise<void> {
    setCreating(true)
    try {
      const created = await api.createApiKey(newName.trim() || 'Clé API')
      setCreatedSecret(created)
      setCopied(false)
      setNewName('')
      await reload()
    } finally {
      setCreating(false)
    }
  }

  async function revoke(id: string): Promise<void> {
    setRevoking(id)
    try {
      await api.revokeApiKey(id)
      await reload()
    } finally {
      setRevoking(null)
    }
  }

  const money = (v: number): string =>
    new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(v)

  const fmtLimit = (value: number): string =>
    value === -1 ? t('dev.usage.unlimited') : value.toLocaleString(lang)

  const fmtDate = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleDateString(lang) : t('dev.keys.never')

  const curl = `curl -X POST "https://dyper.app/api/v1/analyze/prompt" \\
  -H "Authorization: Bearer dyk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Que vois-tu ?"}'`

  // Docs publiques : sans session, on n'affiche pas la console.
  if (!user) {
    return (
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
          {t('dev.title')}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500 dark:text-ink-400">
          {t('dev.subtitle')}
        </p>
        <div className="mt-6 rounded-xl border border-ink-200 bg-ink-50 p-6 dark:border-ink-800 dark:bg-ink-950/60">
          <p className="text-sm text-ink-600 dark:text-ink-300">{t('dev.loginRequired')}</p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {t('dev.loginCta')}
          </Link>
        </div>
      </article>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
          {t('dev.title')}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500 dark:text-ink-400">
          {t('dev.subtitle')}
        </p>
      </header>

      {/* Onglets : « Abonnement » mis en avant (bouton dégradé), « Clés & statistiques » discret. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('billing')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
            tab === 'billing'
              ? 'bg-gradient-to-r from-blue-500 to-violet-600 text-white shadow-card hover:brightness-110'
              : 'border border-violet-300 text-violet-700 hover:bg-violet-500/5 dark:border-violet-500/40 dark:text-violet-300'
          )}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 6.2L21 9l-5 4.3 1.6 6.7L12 16.5 6.4 20l1.6-6.7L3 9l6.6-.8L12 2z" />
          </svg>
          {t('dev.tab.billing')}
        </button>
        <button
          type="button"
          onClick={() => setTab('keys')}
          className={cn(
            'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
            tab === 'keys'
              ? 'bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-50'
              : 'text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200'
          )}
        >
          {t('dev.tab.keys')}
        </button>
      </div>

      {tab === 'keys' ? (
        <div className="mt-6">
          {/* Statistiques d'usage */}
          {usage && (
            <div className="surface mb-6 grid gap-4 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-ink-400 dark:text-ink-500">{t('dev.usage.requests')}</p>
                <p className="font-mono text-sm font-semibold text-ink-800 dark:text-ink-100">
                  {usage.usage.requests.toLocaleString(lang)} /{' '}
                  {fmtLimit(usage.limits.monthlyRequests)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-400 dark:text-ink-500">{t('dev.usage.tokens')}</p>
                <p className="font-mono text-sm font-semibold text-ink-800 dark:text-ink-100">
                  {usage.tokenBalance.toLocaleString(lang)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-400 dark:text-ink-500">{t('dev.usage.plan')}</p>
                <p className="font-mono text-sm font-semibold capitalize text-ink-800 dark:text-ink-100">
                  {usage.plan}
                </p>
                <p className="text-[11px] text-ink-400 dark:text-ink-500">
                  {t('dev.usage.resets', { date: new Date(usage.resetsAt).toLocaleDateString(lang) })}
                </p>
              </div>
            </div>
          )}

          {/* Secret fraîchement créé */}
          {createdSecret && (
            <div className="surface mb-4 border-emerald-300/60 p-4 dark:border-emerald-500/30">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {t('dev.keys.secretTitle')}
              </p>
              <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                {t('dev.keys.secretWarn')}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-ink-950 px-3 py-2 font-mono text-xs text-emerald-300">
                  {createdSecret.secret}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(createdSecret.secret)
                    setCopied(true)
                  }}
                  className="shrink-0 rounded-lg bg-ink-800 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-700 dark:bg-ink-200 dark:text-ink-900"
                >
                  {copied ? t('dev.keys.copied') : t('dev.keys.copy')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setCreatedSecret(null)}
                className="mt-3 text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
              >
                {t('dev.keys.done')}
              </button>
            </div>
          )}

          {/* Création */}
          <div className="mb-4 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('dev.keys.namePlaceholder')}
              maxLength={80}
              className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
            />
            <button
              type="button"
              onClick={() => void create()}
              disabled={creating}
              className="shrink-0 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {creating ? t('dev.keys.creating') : t('dev.keys.create')}
            </button>
          </div>

          {/* Liste des clés */}
          {keys.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-400 dark:border-ink-700 dark:text-ink-500">
              {t('dev.keys.empty')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {keys.map((k) => (
                <li key={k.id} className="surface flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">
                      {k.name}
                    </p>
                    <p className="truncate font-mono text-xs text-ink-400 dark:text-ink-500">
                      {k.prefix}… · {t('dev.keys.created', { date: fmtDate(k.createdAt) })} ·{' '}
                      {t('dev.keys.lastUsed', { date: fmtDate(k.lastUsedAt) })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void revoke(k.id)}
                    disabled={revoking === k.id}
                    className="shrink-0 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-500 transition-colors hover:border-rose-300 hover:text-rose-500 disabled:opacity-50 dark:border-ink-700 dark:text-ink-400"
                  >
                    {revoking === k.id ? t('dev.keys.revoking') : t('dev.keys.revoke')}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Prise en main */}
          <h2 className="mb-2 mt-10 text-lg font-bold text-ink-900 dark:text-ink-50">
            {t('dev.howto.title')}
          </h2>
          <p className="mb-3 text-sm text-ink-500 dark:text-ink-400">{t('dev.howto.desc')}</p>
          <pre className="overflow-x-auto rounded-xl bg-ink-950 p-4 text-xs leading-relaxed text-ink-200">
            <code>{curl}</code>
          </pre>
        </div>
      ) : (
        <div className="mt-6">
          {/* Forfaits API (4 offres dont illimitée) */}
          <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">{t('dev.plan.subtitle')}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {API_PLANS.map((def, idx) => {
              const isCurrent = currentPlan === def.id
              const currentRank = API_PLANS.findIndex((p) => p.id === currentPlan)
              // Forfaits payants inférieurs au forfait courant : grisés (downgrade non proposé).
              // Le gratuit reste toujours disponible.
              const isLowerPaid = def.id !== 'free' && idx < currentRank
              const disabled = isCurrent || isLowerPaid
              return (
                <section
                  key={def.id}
                  className={cn(
                    'surface relative flex flex-col p-4',
                    def.id === 'unlimited' && 'ring-2 ring-amber-400/60',
                    def.featured && 'ring-2 ring-violet-500/60',
                    isLowerPaid && 'opacity-50'
                  )}
                >
                  {def.id === 'unlimited' && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                      {t('dev.plan.unlimitedBadge')}
                    </span>
                  )}
                  <h3 className="text-base font-bold text-ink-900 dark:text-ink-50">{def.name}</h3>
                  <p className="mt-2">
                    <span className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
                      {money(def.priceEur)}
                    </span>
                    {def.id !== 'free' && (
                      <span className="ml-1 text-xs text-ink-400">{t('dev.plan.perMonth')}</span>
                    )}
                  </p>
                  <ul className="mt-3 flex flex-1 flex-col gap-1.5 text-xs text-ink-600 dark:text-ink-300">
                    <li>{t('dev.plan.req', { n: fmtLimit(def.monthlyRequests) })}</li>
                    <li>{t('dev.plan.rate', { n: def.rate })}</li>
                    <li>{t(`dev.plan.priority.${def.id}`)}</li>
                  </ul>
                  <button
                    type="button"
                    onClick={() =>
                      def.id === 'free'
                        ? setCancelOpen(true)
                        : setPurchase({
                            kind: 'plan',
                            plan: def.id,
                            label: def.name,
                            priceEur: def.priceEur,
                          })
                    }
                    disabled={disabled}
                    className={cn(
                      'mt-4 w-full rounded-xl px-3 py-2 text-sm font-semibold transition-all',
                      disabled
                        ? 'cursor-default bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500'
                        : 'bg-gradient-to-r from-blue-500 to-violet-600 text-white hover:brightness-110'
                    )}
                  >
                    {isCurrent
                      ? t('dev.plan.current')
                      : isLowerPaid
                        ? t('dev.plan.included')
                        : t('dev.plan.choose')}
                  </button>
                </section>
              )
            })}
          </div>

          {/* Packs de tokens */}
          <h2 className="mb-1 mt-10 text-lg font-bold text-ink-900 dark:text-ink-50">
            {t('dev.tokens.title')}
          </h2>
          <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">{t('dev.tokens.subtitle')}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {TOKEN_PACKS.map((pack) => (
              <section key={pack.id} className="surface flex flex-col items-start p-4">
                <p className="font-mono text-lg font-bold text-ink-900 dark:text-ink-50">
                  {pack.tokens.toLocaleString(lang)}
                </p>
                <p className="text-xs text-ink-400 dark:text-ink-500">{t('dev.tokens.unit')}</p>
                <p className="mt-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
                  {money(pack.priceEur)}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setPurchase({
                      kind: 'tokens',
                      pack: pack.id,
                      tokens: pack.tokens,
                      priceEur: pack.priceEur,
                    })
                  }
                  className="mt-3 w-full rounded-xl border border-ink-300 px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:border-violet-400 hover:text-violet-700 dark:border-ink-600 dark:text-ink-200"
                >
                  {t('dev.tokens.buy')}
                </button>
              </section>
            ))}
          </div>
        </div>
      )}

      {purchase && (
        <ApiCheckoutModal
          purchase={purchase}
          onConfirm={async () => {
            if (purchase.kind === 'plan') {
              await api.apiCheckout(purchase.plan)
              await refresh()
            } else {
              await api.buyApiTokens(purchase.pack)
            }
            await reload()
          }}
          onClose={() => setPurchase(null)}
        />
      )}

      {cancelOpen && (
        <CancelSubscriptionModal
          title={t('dev.cancel.title')}
          description={t('dev.cancel.desc')}
          onConfirm={async () => {
            await api.apiCheckout('free')
            await refresh()
            await reload()
          }}
          onClose={() => setCancelOpen(false)}
        />
      )}
    </div>
  )
}
