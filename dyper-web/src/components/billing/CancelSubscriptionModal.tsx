// Modale d'ANNULATION d'abonnement (et non de paiement) : affichée quand on revient au forfait
// gratuit, côté site comme côté API. Confirmation simple — aucune carte, aucun paiement.
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'

interface Props {
  /** Titre contextuel (site ou API), déjà localisé. */
  title: string
  /** Description contextuelle, déjà localisée. */
  description: string
  /** Effectue réellement le retour au forfait gratuit. */
  onConfirm: () => Promise<void>
  onClose: () => void
}

type Status = 'confirm' | 'processing' | 'success'

export function CancelSubscriptionModal({ title, description, onConfirm, onClose }: Props) {
  const { t } = useI18n()
  const [status, setStatus] = useState<Status>('confirm')

  async function confirm(): Promise<void> {
    if (status !== 'confirm') return
    setStatus('processing')
    try {
      await onConfirm()
      setStatus('success')
      setTimeout(onClose, 1000)
    } catch {
      setStatus('confirm')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <motion.button
        type="button"
        aria-label={t('billing.cancel.keep')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={status === 'confirm' ? onClose : undefined}
        className="fixed inset-0 bg-ink-950/70 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="surface relative z-10 my-auto w-full max-w-md bg-white p-6 dark:bg-ink-800"
      >
        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid place-items-center gap-3 py-8 text-center"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-ink-200 text-ink-600 dark:bg-ink-700 dark:text-ink-200">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <p className="text-base font-semibold text-ink-900 dark:text-ink-50">
                {t('billing.cancel.success')}
              </p>
            </motion.div>
          ) : (
            <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="grid h-11 w-11 place-items-center rounded-full bg-rose-500/10 text-rose-500">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h2 className="mt-3 text-lg font-bold tracking-tight text-ink-900 dark:text-ink-50">
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
                {description}
              </p>

              <div className="mt-6 flex gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={status === 'processing'}
                  className="flex-1 rounded-xl border border-ink-300 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-100 disabled:opacity-50 dark:border-ink-600 dark:text-ink-200 dark:hover:bg-ink-800"
                >
                  {t('billing.cancel.keep')}
                </button>
                <button
                  type="button"
                  onClick={() => void confirm()}
                  disabled={status === 'processing'}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-600 disabled:opacity-60"
                >
                  {status === 'processing' ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      {t('billing.cancel.processing')}
                    </>
                  ) : (
                    t('billing.cancel.confirm')
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
