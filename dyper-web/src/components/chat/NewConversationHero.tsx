// Héros d'accueil d'une nouvelle conversation : zone de dépôt riche (drag & drop, parcourir,
// coller, URL), vitrine des capacités, aperçu complet du média et lancement de l'analyse.
import { AnimatePresence, motion } from 'framer-motion'
import { type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../../assets/dyper-logo.svg'
import { useI18n } from '../../contexts/I18nContext'
import { usePlan } from '../../hooks/usePlan'
import { cn } from '../../lib/cn'
import type { PendingAttachment } from '../../types'
import { formatBytes, formatTimecode } from '../../utils/formatters'
import { VideoPlayer } from '../result/VideoPlayer'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { StatChip } from '../ui/StatChip'

const FORMAT_CHIPS = ['JPEG', 'PNG', 'WebP', 'GIF', 'MP4']

// Vitrine des capacités réelles du moteur (vend les features d'un coup d'œil).
const CAPABILITIES: { key: string; icon: ReactNode }[] = [
  {
    key: 'hero.cap.objects',
    icon: (
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
    ),
  },
  {
    key: 'hero.cap.scene',
    icon: (
      <>
        <path d="M3 20h18" />
        <path d="M6 20l4-6 3 3 2-4 3 7" />
      </>
    ),
  },
  { key: 'hero.cap.colors', icon: <path d="M12 3c4 5 6 7 6 10a6 6 0 0 1-12 0c0-3 2-5 6-10z" /> },
  { key: 'hero.cap.transcript', icon: <path d="M4 5h16v10H8l-4 4V5z" /> },
  {
    key: 'hero.cap.music',
    icon: (
      <>
        <path d="M9 18V6l10-2v10" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="16" r="2" />
      </>
    ),
  },
]

interface Props {
  attachment: PendingAttachment | null
  checking: boolean
  error: string | null
  analyzeDisabled: boolean
  onPickFile: (file: File) => void
  onAttachUrl: (url: string) => void
  onRemoveAttachment: () => void
  /** Lance l'analyse du média joint (aucune question pré-analyse : on discute après). */
  onSubmit: (text: string) => void
}

export function NewConversationHero({
  attachment,
  checking,
  error,
  analyzeDisabled,
  onPickFile,
  onAttachUrl,
  onRemoveAttachment,
  onSubmit,
}: Props) {
  const { t } = useI18n()
  const { fileLimits } = usePlan()
  const [dragging, setDragging] = useState(false)
  const [urlMode, setUrlMode] = useState(false)
  const [url, setUrl] = useState('')
  const dragDepthRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)

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

  // Focalise le champ URL à son ouverture (révélé par une action volontaire).
  useEffect(() => {
    if (urlMode) urlInputRef.current?.focus()
  }, [urlMode])

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
        {/* En-tête : halo dégradé derrière le logo. */}
        <div className="relative mb-7 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-40 w-40 -translate-x-1/2 -translate-y-6 rounded-full bg-gradient-to-br from-blue-500/25 to-violet-600/25 blur-3xl"
          />
          <Link to="/" aria-label="Dyper AI" className="mb-4 inline-block">
            <img src={logo} alt="Dyper AI" className="h-16 w-16 rounded-2xl object-contain" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
            {t('hero.title')}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink-500 dark:text-ink-400">
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
                <div>
                  {attachment.thumbnailUrl && (
                    <img
                      src={attachment.thumbnailUrl}
                      alt=""
                      className="max-h-80 w-full bg-ink-950 object-contain"
                    />
                  )}
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
                </div>
              ) : fileAttachment?.isVideo ? (
                fileAttachment.previewUrl && (
                  <VideoPlayer
                    src={fileAttachment.previewUrl}
                    frames={[]}
                    sourceWidth={null}
                    sourceHeight={null}
                    poster={fileAttachment.thumbnailUrl ?? undefined}
                    rounded={false}
                  />
                )
              ) : (
                fileAttachment?.previewUrl && (
                  <img
                    src={fileAttachment.previewUrl}
                    alt={fileAttachment.file.name}
                    className="max-h-80 w-full bg-ink-950 object-contain"
                  />
                )
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-4 pt-3 dark:border-ink-800">
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
                <Button variant="ghost" size="sm" onClick={onRemoveAttachment}>
                  {t('chat.attach.remove')}
                </Button>
              </div>

              {/* Lancement de l'analyse (la confirmation se fait ici, aperçu en tête). */}
              <div className="p-4">
                <button
                  type="button"
                  onClick={() => onSubmit('')}
                  disabled={analyzeDisabled || checking}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:shadow-card-hover hover:brightness-110 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4-4" strokeLinecap="round" />
                  </svg>
                  {t('hero.analyze')}
                </button>
              </div>
            </motion.div>
          ) : (
            /* ─── Zone de dépôt + vitrine des capacités ───────────────────── */
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
                  'relative block w-full overflow-hidden rounded-3xl border-2 border-dashed px-4 py-10 text-center transition-all duration-200 sm:px-8 sm:py-16',
                  dragging
                    ? 'scale-[1.01] border-brand-500 bg-brand-50 shadow-card-hover dark:bg-brand-600/10'
                    : 'border-ink-300 bg-gradient-to-b from-ink-50 to-white hover:border-brand-400 hover:from-brand-50/50 dark:border-ink-700 dark:from-ink-800/40 dark:to-ink-900 dark:hover:border-brand-500'
                )}
              >
                <motion.div
                  animate={dragging ? { y: [0, -8, 0] } : { y: [0, -4, 0] }}
                  transition={{
                    repeat: Number.POSITIVE_INFINITY,
                    duration: dragging ? 0.8 : 3,
                    ease: 'easeInOut',
                  }}
                  className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-lg shadow-violet-600/25"
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
                <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">
                  {t('hero.limits', { img: fileLimits.maxImageMb, vid: fileLimits.maxVideoMb })}
                </p>
              </button>

              {/* Option URL (seule entrée secondaire : Dyper analyse des médias, pas du texte). */}
              <div className="mt-4 flex flex-col items-center gap-2 text-center">
                {urlMode ? (
                  <div className="flex w-full max-w-md items-center gap-2">
                    <input
                      ref={urlInputRef}
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitUrl()
                        if (e.key === 'Escape') setUrlMode(false)
                      }}
                      placeholder={t('chat.attach.urlPlaceholder')}
                      className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:shadow-focus dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50"
                    />
                    <Button size="sm" onClick={submitUrl}>
                      {t('chat.attach.urlAdd')}
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setUrlMode(true)}
                    className="text-sm text-violet-600 hover:underline dark:text-violet-400"
                  >
                    {t('hero.orUrl')}
                  </button>
                )}
              </div>

              {/* Vitrine des capacités. */}
              <div className="mt-8">
                <p className="eyebrow mb-3 text-center">{t('hero.cap.title')}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CAPABILITIES.map((cap) => (
                    <StatChip key={cap.key} icon={cap.icon} label={t(cap.key)} />
                  ))}
                </div>
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
