// Héros d'accueil d'une nouvelle conversation : zone de dépôt riche (drag & drop, parcourir,
// coller, URL), aperçu complet du média sélectionné et lancement de l'analyse.
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { PendingAttachment } from '../../types'
import { formatBytes, formatTimecode } from '../../utils/formatters'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'

const FORMAT_CHIPS = ['JPEG', 'PNG', 'WebP', 'GIF', 'MP4']

interface Props {
  attachment: PendingAttachment | null
  checking: boolean
  error: string | null
  analyzeDisabled: boolean
  onPickFile: (file: File) => void
  onAttachUrl: (url: string) => void
  onRemoveAttachment: () => void
  onAnalyze: () => void
}

export function NewConversationHero({
  attachment,
  checking,
  error,
  analyzeDisabled,
  onPickFile,
  onAttachUrl,
  onRemoveAttachment,
  onAnalyze,
}: Props) {
  const { t } = useI18n()
  const [dragging, setDragging] = useState(false)
  const [urlMode, setUrlMode] = useState(false)
  const [url, setUrl] = useState('')
  const dragDepthRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Collage direct d'une image depuis le presse-papiers (Ctrl+V) tant que le héros est affiché.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
      )
      if (file) onPickFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [onPickFile])

  function handleDrop(e: DragEvent): void {
    e.preventDefault()
    dragDepthRef.current = 0
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onPickFile(file)
  }

  function submitUrl(): void {
    const value = url.trim()
    if (!value) return
    onAttachUrl(value)
    setUrlMode(false)
    setUrl('')
  }

  const fileAttachment = attachment?.kind === 'file' ? attachment : null

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* En-tête. */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-card-hover">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
            {t('hero.title')}
          </h1>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            {t('hero.subtitle')}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {attachment ? (
            /* ─── Aperçu du média sélectionné ─────────────────────────────── */
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="surface overflow-hidden"
            >
              {attachment.kind === 'url' ? (
                <div className="flex items-center gap-3 p-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink-700 dark:text-ink-200">
                    {attachment.url}
                  </span>
                </div>
              ) : fileAttachment?.isVideo ? (
                fileAttachment.previewUrl && (
                  // biome-ignore lint/a11y/useMediaCaption: aperçu local avant analyse, sans piste de sous-titres disponible.
                  <video
                    src={fileAttachment.previewUrl}
                    controls
                    preload="metadata"
                    className="max-h-80 w-full bg-ink-900 object-contain"
                  />
                )
              ) : (
                fileAttachment?.previewUrl && (
                  <img
                    src={fileAttachment.previewUrl}
                    alt={fileAttachment.file.name}
                    className="max-h-80 w-full bg-ink-900 object-contain"
                  />
                )
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 p-4 dark:border-ink-800">
                <div className="min-w-0">
                  {fileAttachment && (
                    <>
                      <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">
                        {fileAttachment.file.name}
                      </p>
                      <p className="text-xs text-ink-400 dark:text-ink-500">
                        {formatBytes(fileAttachment.file.size)}
                        {fileAttachment.durationS !== undefined &&
                          ` · ${formatTimecode(fileAttachment.durationS)}`}
                        {checking && (
                          <span className="ml-2 inline-flex items-center gap-1">
                            <Spinner className="h-3 w-3" /> {t('input.checkingVideo')}
                          </span>
                        )}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={onRemoveAttachment}>
                    {t('chat.attach.remove')}
                  </Button>
                  <Button size="sm" onClick={onAnalyze} disabled={analyzeDisabled || checking}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4-4" strokeLinecap="round" />
                    </svg>
                    {t('hero.analyze')}
                  </Button>
                </div>
              </div>
              <p className="border-t border-ink-100 px-4 py-2.5 text-center text-xs text-ink-400 dark:border-ink-800 dark:text-ink-500">
                {t('hero.optionalHint')}
              </p>
            </motion.div>
          ) : (
            /* ─── Zone de dépôt ───────────────────────────────────────────── */
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault()
                  dragDepthRef.current += 1
                  setDragging(true)
                }}
                onDragLeave={() => {
                  dragDepthRef.current -= 1
                  if (dragDepthRef.current <= 0) setDragging(false)
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={cn(
                  'relative block w-full rounded-3xl border-2 border-dashed px-8 py-14 text-center transition-all duration-200',
                  dragging
                    ? 'scale-[1.01] border-brand-500 bg-brand-50 shadow-card-hover dark:bg-brand-600/10'
                    : 'border-ink-300 bg-white hover:border-brand-400 hover:bg-brand-50/40 dark:border-ink-700 dark:bg-ink-800/40 dark:hover:border-brand-500 dark:hover:bg-brand-600/5'
                )}
              >
                <motion.div
                  animate={dragging ? { y: [0, -6, 0] } : { y: 0 }}
                  transition={dragging ? { repeat: Number.POSITIVE_INFINITY, duration: 0.9 } : {}}
                  className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg"
                >
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 16V4m0 0L8 8m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
                  </svg>
                </motion.div>

                <p className="text-base font-semibold text-ink-800 dark:text-ink-100">
                  {dragging ? t('chat.drop.hint') : t('hero.drop')}
                </p>
                <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
                  {t('hero.browse')} · {t('hero.paste')}
                </p>

                {/* Formats acceptés + limites. */}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
                  {FORMAT_CHIPS.map((format) => (
                    <span
                      key={format}
                      className="rounded-full bg-ink-100 px-2.5 py-0.5 font-mono text-[11px] text-ink-500 dark:bg-ink-800 dark:text-ink-400"
                    >
                      {format}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">{t('hero.limits')}</p>
              </button>

              {/* Option URL. */}
              <div className="mt-4 text-center">
                {urlMode ? (
                  <div className="mx-auto flex max-w-md items-center gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitUrl()
                        if (e.key === 'Escape') setUrlMode(false)
                      }}
                      placeholder={t('chat.attach.urlPlaceholder')}
                      // biome-ignore lint/a11y/noAutofocus: champ révélé par une action volontaire de l'utilisateur.
                      autoFocus
                      className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:shadow-focus dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50"
                    />
                    <Button size="sm" onClick={submitUrl}>
                      {t('chat.attach.urlAdd')}
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setUrlMode(true)}
                    className="text-sm text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {t('hero.orUrl')}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p className="mt-3 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onPickFile(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
