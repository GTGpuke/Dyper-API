// Menu du bouton d'attache : import de fichier ou analyse d'une image par URL.
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'

export function AttachMenu({
  onPickFile,
  onSubmitUrl,
  disabled = false,
}: {
  onPickFile: (file: File) => void
  onSubmitUrl: (url: string) => void
  disabled?: boolean
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [urlMode, setUrlMode] = useState(false)
  const [url, setUrl] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)

  // Fermeture au clic extérieur et sur Échap.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (urlMode) urlInputRef.current?.focus()
  }, [urlMode])

  function close(): void {
    setOpen(false)
    setUrlMode(false)
    setUrl('')
  }

  function submitUrl(): void {
    const value = url.trim()
    if (!value) return
    onSubmitUrl(value)
    close()
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="grid h-9 w-9 place-items-center rounded-xl text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:text-ink-400 dark:hover:bg-ink-700 dark:hover:text-ink-200"
        aria-label={t('chat.composer.attach')}
        title={t('chat.composer.attach')}
        aria-expanded={open}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPickFile(file)
          e.target.value = ''
          close()
        }}
      />

      {open && (
        <div className="absolute bottom-11 left-0 z-20 w-64 rounded-xl border border-ink-200 bg-white p-1.5 shadow-card-hover dark:border-ink-700 dark:bg-ink-800">
          {urlMode ? (
            <div className="flex items-center gap-1.5 p-1">
              <input
                ref={urlInputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitUrl()
                  }
                }}
                placeholder={t('chat.attach.urlPlaceholder')}
                className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-400 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-50"
              />
              <button
                type="button"
                onClick={submitUrl}
                className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                {t('chat.attach.urlAdd')}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-700"
              >
                <svg className="h-4 w-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t('chat.attach.file')}
              </button>
              <button
                type="button"
                onClick={() => setUrlMode(true)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-700"
              >
                <svg className="h-4 w-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t('chat.attach.url')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
