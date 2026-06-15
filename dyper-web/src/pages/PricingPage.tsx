// Page Forfaits : trois offres avec privilèges, quotas et minutes vidéo. La souscription passe par
// une page de paiement FACTICE (Dyper Pay) ; aucune facturation réelle. Le forfait choisi est
// appliqué côté API et les quotas associés sont réellement respectés par la passerelle.
import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { CancelSubscriptionModal } from '../components/billing/CancelSubscriptionModal'
import { PageContainer } from '../components/layout/PageContainer'
import { FakeCheckoutModal } from '../components/pricing/FakeCheckoutModal'
import { useI18n } from '../contexts/I18nContext'
import { usePlan } from '../hooks/usePlan'
import { cn } from '../lib/cn'
import * as api from '../services/api'
import type { PlanId, UsageView } from '../types'

interface PlanDef {
  id: PlanId
  priceKey: string
  featured?: boolean
  features: string[]
}

const PLANS: PlanDef[] = [
  {
    id: 'free',
    priceKey: 'pricing.free.price',
    features: [
      'pricing.feat.tokens.free',
      'pricing.feat.minutes.free',
      'pricing.feat.chapters.basic',
      'pricing.feat.queue.standard',
      'pricing.feat.support.community',
    ],
  },
  {
    id: 'pro',
    priceKey: 'pricing.pro.price',
    featured: true,
    features: [
      'pricing.feat.tokens.pro',
      'pricing.feat.minutes.pro',
      'pricing.feat.chapters.detailed',
      'pricing.feat.queue.priority',
      'pricing.feat.support.email',
      'pricing.feat.export',
    ],
  },
  {
    id: 'studio',
    priceKey: 'pricing.studio.price',
    features: [
      'pricing.feat.tokens.studio',
      'pricing.feat.minutes.studio',
      'pricing.feat.chapters.detailed',
      'pricing.feat.queue.dedicated',
      'pricing.feat.support.priority',
      'pricing.feat.api',
    ],
  },
]

export function PricingPage() {
  const { t, lang } = useI18n()
  const { plan, subscribe } = usePlan()
  const [usage, setUsage] = useState<UsageView | null>(null)
  const [checkoutTarget, setCheckoutTarget] = useState<PlanDef | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  // Consommation courante (rafraîchie quand le forfait change).
  useEffect(() => {
    let cancelled = false
    api
      .getUsage()
      .then((u) => {
        if (!cancelled) setUsage(u)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [plan])

  function handleChoose(def: PlanDef): void {
    // Revenir au gratuit = annuler l'abonnement : on ouvre la modale d'annulation (pas de paiement).
    if (def.id === 'free') {
      setCancelOpen(true)
      return
    }
    setCheckoutTarget(def)
  }

  const fmtLimit = (value: number): string =>
    value === -1 ? t('pricing.usage.unlimited') : String(value)

  return (
    <PageContainer>
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
            {t('pricing.title')}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            {t('pricing.subtitle')}
          </p>
          <p className="mt-3 inline-block rounded-full bg-ink-100 px-3 py-1 text-xs text-ink-500 dark:bg-ink-800 dark:text-ink-400">
            {t('pricing.demoNotice')}
          </p>
        </header>

        {/* Consommation du mois en cours (forfait courant). */}
        {usage && (
          <div className="surface mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                {t('pricing.usage.title')}
              </p>
              <p className="text-xs text-ink-400 dark:text-ink-500">
                {t('pricing.usage.resets', {
                  date: new Date(usage.resetsAt).toLocaleDateString(lang),
                })}
              </p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-ink-400 dark:text-ink-500">
                  {t('pricing.usage.analyses')}
                </p>
                <p className="font-mono text-sm font-semibold text-ink-800 dark:text-ink-100">
                  {usage.usage.analyses} / {fmtLimit(usage.limits.monthlyAnalyses)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-400 dark:text-ink-500">
                  {t('pricing.usage.videoMinutes')}
                </p>
                <p className="font-mono text-sm font-semibold text-ink-800 dark:text-ink-100">
                  {usage.usage.videoMinutes} / {fmtLimit(usage.limits.monthlyVideoMinutes)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((def, idx) => {
            const isCurrent = plan === def.id
            const currentRank = PLANS.findIndex((p) => p.id === plan)
            // Forfaits payants de rang inférieur au forfait courant : grisés (le gratuit reste dispo).
            const isLowerPaid = def.id !== 'free' && idx < currentRank
            return (
              <section
                key={def.id}
                className={cn(
                  'surface relative flex flex-col p-5',
                  def.featured &&
                    'border-transparent bg-gradient-to-b from-blue-500/[0.07] to-violet-600/[0.07] ring-2 ring-violet-500/60 md:-my-2 md:py-7',
                  isLowerPaid && 'opacity-50'
                )}
              >
                {def.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-violet-600 px-3 py-0.5 text-[11px] font-semibold text-white shadow-card">
                    {t('pricing.popular')}
                  </span>
                )}

                <h2 className="text-lg font-bold text-ink-900 dark:text-ink-50">
                  {t(`pricing.${def.id}.name`)}
                </h2>
                <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
                  {t(`pricing.${def.id}.desc`)}
                </p>

                <p className="mt-4">
                  <span className="text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
                    {t(def.priceKey)}
                  </span>
                  <span className="ml-1 text-sm text-ink-400 dark:text-ink-500">
                    {def.id !== 'free' && t('pricing.perMonth')}
                  </span>
                </p>

                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {def.features.map((key) => (
                    <li
                      key={key}
                      className="flex items-start gap-2 text-sm text-ink-600 dark:text-ink-300"
                    >
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-violet-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {t(key)}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => void handleChoose(def)}
                  disabled={isCurrent || isLowerPaid}
                  className={cn(
                    'mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
                    isCurrent || isLowerPaid
                      ? 'cursor-default bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500'
                      : def.featured
                        ? 'bg-gradient-to-r from-blue-500 to-violet-600 text-white shadow-card hover:shadow-card-hover hover:brightness-110'
                        : 'border border-ink-300 text-ink-700 hover:border-violet-400 hover:text-violet-700 dark:border-ink-600 dark:text-ink-200 dark:hover:border-violet-500 dark:hover:text-violet-300'
                  )}
                >
                  {isCurrent
                    ? t('pricing.current')
                    : isLowerPaid
                      ? t('pricing.included')
                      : def.id === 'free'
                        ? t('pricing.downgrade')
                        : t('pricing.choose')}
                </button>
              </section>
            )
          })}
        </div>

        <p className="mt-8 text-center text-xs text-ink-400 dark:text-ink-500">
          {t('pricing.footnote')}
        </p>
      </div>

      <AnimatePresence>
        {checkoutTarget && checkoutTarget.id !== 'free' && (
          <FakeCheckoutModal
            initialPlan={checkoutTarget.id}
            previousPlan={plan}
            onConfirm={(p) => subscribe(p)}
            onClose={() => setCheckoutTarget(null)}
          />
        )}
        {cancelOpen && (
          <CancelSubscriptionModal
            title={t('pricing.cancel.title')}
            description={t('pricing.cancel.desc')}
            onConfirm={() => subscribe('free')}
            onClose={() => setCancelOpen(false)}
          />
        )}
      </AnimatePresence>
    </PageContainer>
  )
}
