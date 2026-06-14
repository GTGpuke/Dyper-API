// Boîte de dialogue de publication d'une analyse au feed « Global » (légende optionnelle).
// Gère le refus de modération (contenu sensible) avec un message clair.
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../contexts/I18nContext'
import { publishAnalysis } from '../../services/api'
import type { ApiError, Publication } from '../../types'
import { Button } from '../ui/Button'

export function PublishDialog({
  analysisId,
  open,
  onClose,
}: {
  analysisId: string
  open: boolean
  onClose: () => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Publication | null>(null)

  async function submit(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      setDone(await publishAnalysis(analysisId, caption.trim() || undefined))
    } catch (e) {
      setError((e as ApiError).message ?? t('publish.error'))
    } finally {
      setBusy(false)
    }
  }

  function close(): void {
    setCaption('')
    setError(null)
    setDone(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={close}
            className="absolute inset-0 cursor-default bg-ink-950/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            className="relative w-full max-w-md rounded-2xl border border-ink-200 bg-white p-6 shadow-2xl dark:border-ink-700 dark:bg-ink-900"
          >
            {done ? (
              <div className="flex flex-col gap-4 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-lg font-bold text-ink-900 dark:text-ink-50">
                    {t('publish.done.title')}
                  </h2>
                  <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
                    {t('publish.done.desc')}
                  </p>
                </div>
                <div className="flex justify-center gap-2">
                  <Button variant="secondary" size="sm" onClick={close}>
                    {t('common.close')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const id = done.id
                      close()
                      navigate(`/global/${id}`)
                    }}
                  >
                    {t('publish.done.view')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-ink-900 dark:text-ink-50">
                  {t('publish.title')}
                </h2>
                <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{t('publish.desc')}</p>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder={t('publish.caption')}
                  className="mt-4 w-full resize-y rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:shadow-focus dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50"
                />
                {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
                <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">
                  {t('publish.moderationNote')}
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={close}>
                    {t('common.cancel')}
                  </Button>
                  <Button size="sm" loading={busy} onClick={submit}>
                    {t('publish.submit')}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
