// Page de paiement FACTICE (« Dyper Pay ») — reproduit fidèlement un tunnel d'abonnement réel :
// choix du forfait, détails de commande (prorata, TVA, total du jour), avis de renouvellement,
// moyen de paiement éditable et acceptation des conditions. AUCUNE transaction réelle : à la
// validation, on simule un court traitement puis on applique le forfait via l'API (POST /me/checkout).
import { AnimatePresence, motion } from 'framer-motion'
import { type FormEvent, useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { PlanId } from '../../types'

type PaidPlan = 'pro' | 'studio'

interface Props {
  /** Forfait présélectionné (celui cliqué sur la grille). */
  initialPlan: PaidPlan
  /** Forfait courant de l'utilisateur (pour le crédit au prorata). */
  previousPlan: PlanId
  /** Applique réellement le forfait choisi (paiement factice côté API). */
  onConfirm: (plan: PlanId) => Promise<void>
  onClose: () => void
}

type Status = 'form' | 'processing' | 'success'

// Tarifs hors taxes (€/mois). Source unique pour le calcul de la commande.
const PRICE_HT: Record<PaidPlan, number> = { pro: 9.99, studio: 29.99 }
const VAT_RATE = 0.2

// Formatte un numéro de carte en groupes de 4 chiffres (16 max).
function formatCard(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim()
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function FakeCheckoutModal({ initialPlan, previousPlan, onConfirm, onClose }: Props) {
  const { t, lang } = useI18n()
  const [plan, setPlan] = useState<PaidPlan>(initialPlan)
  const [status, setStatus] = useState<Status>('form')
  const [accepted, setAccepted] = useState(false)
  const [editingCard, setEditingCard] = useState(false)
  const [card, setCard] = useState('4242 4242 4242 4242')
  const [expiry, setExpiry] = useState('12/30')
  const [cvc, setCvc] = useState('123')
  const [name, setName] = useState('')

  const money = (value: number): string =>
    new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(value)

  // Détails de commande : crédit au prorata si l'on quitte un forfait payant en cours de mois.
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const remainingFraction =
    (endOfMonth.getTime() - now.getTime()) / (endOfMonth.getTime() - startOfMonth.getTime())

  const priceHt = PRICE_HT[plan]
  const prorataCredit =
    previousPlan === 'pro' || previousPlan === 'studio'
      ? Math.round(PRICE_HT[previousPlan as PaidPlan] * remainingFraction * 100) / 100
      : 0
  const subtotal = Math.max(0, Math.round((priceHt - prorataCredit) * 100) / 100)
  const vat = Math.round(subtotal * VAT_RATE * 100) / 100
  const total = Math.round((subtotal + vat) * 100) / 100

  const renewDate = endOfMonth.toLocaleDateString(lang, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const planName = t(`pricing.${plan}.name`)
  const canPay = accepted && status === 'form'

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!canPay) return
    setStatus('processing')
    try {
      await new Promise((resolve) => setTimeout(resolve, 1300))
      await onConfirm(plan)
      setStatus('success')
      setTimeout(onClose, 1200)
    } catch {
      setStatus('form')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <motion.button
        type="button"
        aria-label={t('pricing.pay.cancel')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={status === 'form' ? onClose : undefined}
        className="fixed inset-0 bg-ink-950/70 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="surface relative z-10 my-auto w-full max-w-lg overflow-hidden bg-white p-0 dark:bg-ink-800"
      >
        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid place-items-center gap-3 px-6 py-16 text-center"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <p className="text-base font-semibold text-ink-900 dark:text-ink-50">
                {t('pricing.pay.success')}
              </p>
              <p className="text-sm text-ink-500 dark:text-ink-400">
                {t('pricing.pay.subtitle', { plan: planName, price: money(priceHt) })}
              </p>
            </motion.div>
          ) : (
            <form key="form" onSubmit={handleSubmit} className="flex flex-col">
              {/* En-tête */}
              <div className="flex items-start justify-between gap-3 px-6 pt-6">
                <h2 className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
                  {t('pricing.pay.title', { plan: planName })}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={status === 'processing'}
                  aria-label={t('pricing.pay.cancel')}
                  className="shrink-0 rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600 dark:hover:bg-ink-800"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="flex flex-col gap-5 px-6 pb-6 pt-4">
                {/* Choix du forfait */}
                <div className="grid grid-cols-2 gap-3">
                  {(['pro', 'studio'] as PaidPlan[]).map((p) => {
                    const active = plan === p
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPlan(p)}
                        className={cn(
                          'relative rounded-xl border p-3.5 text-left transition-colors',
                          active
                            ? 'border-violet-500 bg-violet-500/[0.06] ring-1 ring-violet-500/40'
                            : 'border-ink-200 hover:border-ink-300 dark:border-ink-700 dark:hover:border-ink-600'
                        )}
                      >
                        {p === 'studio' && (
                          <span className="absolute right-2 top-2 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                            {t('pricing.pay.bestValue')}
                          </span>
                        )}
                        <span
                          className={cn(
                            'mb-2 grid h-4 w-4 place-items-center rounded-full border',
                            active ? 'border-violet-500' : 'border-ink-300 dark:border-ink-600'
                          )}
                        >
                          {active && <span className="h-2 w-2 rounded-full bg-violet-500" />}
                        </span>
                        <p className="text-sm font-bold text-ink-900 dark:text-ink-50">
                          {t(`pricing.${p}.name`)}
                        </p>
                        <p className="mt-0.5 text-xs leading-snug text-ink-500 dark:text-ink-400">
                          {t(`pricing.pay.tier.${p}`)}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
                          {money(PRICE_HT[p])}
                          <span className="text-xs font-normal text-ink-400"> {t('pricing.perMonth')}</span>
                        </p>
                      </button>
                    )
                  })}
                </div>

                {/* Détails de la commande */}
                <div className="rounded-xl border border-ink-200 p-4 dark:border-ink-700">
                  <p className="mb-3 text-sm font-semibold text-ink-800 dark:text-ink-100">
                    {t('pricing.pay.orderDetails')}
                  </p>
                  <dl className="flex flex-col gap-2 text-sm">
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-ink-600 dark:text-ink-300">
                        {t('pricing.pay.planLine', { plan: planName })}
                      </dt>
                      <dd className="font-medium text-ink-800 tabular-nums dark:text-ink-100">
                        {money(priceHt)}
                      </dd>
                    </div>
                    {prorataCredit > 0 && (
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="text-ink-500 dark:text-ink-400">
                          {t('pricing.pay.prorata')}
                        </dt>
                        <dd className="font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
                          −{money(prorataCredit)}
                        </dd>
                      </div>
                    )}
                    <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-ink-100 pt-2 dark:border-ink-800">
                      <dt className="text-ink-600 dark:text-ink-300">{t('pricing.pay.subtotal')}</dt>
                      <dd className="font-medium text-ink-800 tabular-nums dark:text-ink-100">
                        {money(subtotal)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-ink-600 dark:text-ink-300">
                        {t('pricing.pay.vat', { rate: '20' })}
                      </dt>
                      <dd className="font-medium text-ink-800 tabular-nums dark:text-ink-100">
                        {money(vat)}
                      </dd>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-ink-100 pt-2 dark:border-ink-800">
                      <dt className="font-semibold text-ink-900 dark:text-ink-50">
                        {t('pricing.pay.totalToday')}
                      </dt>
                      <dd className="text-base font-bold text-ink-900 tabular-nums dark:text-ink-50">
                        {money(total)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Avis de renouvellement */}
                <div className="flex items-start gap-2.5 rounded-xl bg-ink-50 p-3.5 text-xs leading-relaxed text-ink-500 dark:bg-ink-950/60 dark:text-ink-400">
                  <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t('pricing.pay.renewNotice', { date: renewDate, price: money(priceHt) })}
                </div>

                {/* Moyen de paiement */}
                <div className="rounded-xl border border-ink-200 p-4 dark:border-ink-700">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                      {t('pricing.pay.method')}
                    </p>
                    {!editingCard && (
                      <button
                        type="button"
                        onClick={() => setEditingCard(true)}
                        className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-violet-600 dark:text-ink-400"
                      >
                        <span className="font-mono">Mastercard •••• 0866</span>
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {editingCard && (
                    <div className="mt-3 flex flex-col gap-2.5">
                      <p className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-center text-[11px] text-amber-700 dark:text-amber-300">
                        {t('pricing.pay.demoBadge')}
                      </p>
                      <input
                        inputMode="numeric"
                        value={card}
                        onChange={(e) => setCard(formatCard(e.target.value))}
                        aria-label={t('pricing.pay.card')}
                        className="rounded-lg border border-ink-300 bg-white px-3 py-2 font-mono text-sm tracking-wider text-ink-900 outline-none focus:border-violet-400 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-50"
                        placeholder="4242 4242 4242 4242"
                      />
                      <div className="flex gap-2.5">
                        <input
                          inputMode="numeric"
                          value={expiry}
                          onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                          aria-label={t('pricing.pay.expiry')}
                          className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 font-mono text-sm text-ink-900 outline-none focus:border-violet-400 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-50"
                          placeholder="MM/AA"
                        />
                        <input
                          inputMode="numeric"
                          value={cvc}
                          onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          aria-label={t('pricing.pay.cvc')}
                          className="w-28 rounded-lg border border-ink-300 bg-white px-3 py-2 font-mono text-sm text-ink-900 outline-none focus:border-violet-400 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-50"
                          placeholder="CVC"
                        />
                      </div>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        aria-label={t('pricing.pay.name')}
                        className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-violet-400 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-50"
                        placeholder={t('pricing.pay.namePlaceholder')}
                      />
                    </div>
                  )}
                </div>

                {/* Conditions */}
                <label className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-violet-600 focus:ring-violet-500 dark:border-ink-600"
                  />
                  <span>{t('pricing.pay.terms', { price: money(priceHt) })}</span>
                </label>

                {/* Bouton de validation */}
                <button
                  type="submit"
                  disabled={!canPay}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {status === 'processing' ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      {t('pricing.pay.processing')}
                    </>
                  ) : (
                    t('pricing.pay.subscribe', { total: money(total) })
                  )}
                </button>

                <p className="flex items-center justify-center gap-1.5 text-[11px] text-ink-400 dark:text-ink-500">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
                  </svg>
                  {t('pricing.pay.securedBy')}
                </p>
              </div>
            </form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
