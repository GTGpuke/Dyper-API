// Page Forfaits (vitrine marketing) : trois offres avec privilèges, tokens et minutes vidéo.
// L'abonnement est factice : la sélection est persistée localement, sans facturation.
import { PageContainer } from '../components/layout/PageContainer'
import { useI18n } from '../contexts/I18nContext'
import { type PlanId, usePlan } from '../hooks/usePlan'
import { cn } from '../lib/cn'

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
  const { t } = useI18n()
  const { plan, setPlan } = usePlan()

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

        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((def) => {
            const isCurrent = plan === def.id
            return (
              <section
                key={def.id}
                className={cn(
                  'surface relative flex flex-col p-5',
                  def.featured &&
                    'border-transparent bg-gradient-to-b from-blue-500/[0.07] to-violet-600/[0.07] ring-2 ring-violet-500/60 md:-my-2 md:py-7'
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
                  onClick={() => setPlan(def.id)}
                  disabled={isCurrent}
                  className={cn(
                    'mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
                    isCurrent
                      ? 'cursor-default bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500'
                      : def.featured
                        ? 'bg-gradient-to-r from-blue-500 to-violet-600 text-white shadow-card hover:shadow-card-hover hover:brightness-110'
                        : 'border border-ink-300 text-ink-700 hover:border-violet-400 hover:text-violet-700 dark:border-ink-600 dark:text-ink-200 dark:hover:border-violet-500 dark:hover:text-violet-300'
                  )}
                >
                  {isCurrent ? t('pricing.current') : t('pricing.choose')}
                </button>
              </section>
            )
          })}
        </div>

        <p className="mt-8 text-center text-xs text-ink-400 dark:text-ink-500">
          {t('pricing.footnote')}
        </p>
      </div>
    </PageContainer>
  )
}
