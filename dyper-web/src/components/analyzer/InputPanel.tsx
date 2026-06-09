// Panneau de saisie multimodal : fichier (drag & drop), URL d'image ou prompt texte.
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import { validateFile } from '../../utils/fileHelpers'
import { Button } from '../ui/Button'
import type { AnalyzeInput } from '../../hooks/useAnalyze'

type Mode = 'file' | 'url' | 'prompt'

const TABS: { id: Mode; labelKey: string }[] = [
  { id: 'file', labelKey: 'input.tab.file' },
  { id: 'url', labelKey: 'input.tab.url' },
  { id: 'prompt', labelKey: 'input.tab.prompt' },
]

interface Props {
  loading: boolean
  defaultMode?: Mode
  onSubmit: (input: AnalyzeInput, previewUrl: string | null) => void
}

export function InputPanel({ loading, defaultMode = 'file', onSubmit }: Props) {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [prompt, setPrompt] = useState('')

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    const check = validateFile(f)
    if (!check.valid) {
      setFileError(t('input.fileError'))
      setFile(null)
      return
    }
    setFileError(null)
    setFile(f)
  }, [t])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'image/*': [], 'video/mp4': [] },
  })

  function submit(): void {
    if (mode === 'file' && file) {
      onSubmit({ kind: 'file', file, prompt: prompt || undefined }, URL.createObjectURL(file))
    } else if (mode === 'url' && url.trim()) {
      onSubmit({ kind: 'url', url: url.trim(), prompt: prompt || undefined }, url.trim())
    } else if (mode === 'prompt' && prompt.trim()) {
      onSubmit({ kind: 'prompt', prompt: prompt.trim() }, null)
    }
  }

  const canSubmit =
    (mode === 'file' && !!file) ||
    (mode === 'url' && url.trim().length > 0) ||
    (mode === 'prompt' && prompt.trim().length > 0)

  return (
    <div className="surface p-5">
      {/* Onglets de mode. */}
      <div className="mb-4 inline-flex rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              mode === tab.id
                ? 'bg-white text-ink-800 shadow-sm dark:bg-ink-600 dark:text-ink-50'
                : 'text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200'
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Zone de saisie selon le mode. */}
      {mode === 'file' && (
        <div
          {...getRootProps()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            isDragActive
              ? 'border-brand-400 bg-brand-50 dark:bg-brand-600/10'
              : 'border-ink-200 hover:border-ink-300 dark:border-ink-700 dark:hover:border-ink-600'
          )}
        >
          <input {...getInputProps()} />
          <svg className="h-8 w-8 text-ink-300 dark:text-ink-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 16V4m0 0L8 8m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
          </svg>
          {file ? (
            <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{file.name}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-ink-600 dark:text-ink-300">{t('input.drop')}</p>
              <p className="text-xs text-ink-400 dark:text-ink-500">{t('input.dropHint')}</p>
            </>
          )}
        </div>
      )}

      {mode === 'url' && (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('input.urlPlaceholder')}
          className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm outline-none focus:border-brand-400 focus:shadow-focus dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50 dark:placeholder:text-ink-500"
        />
      )}

      {mode === 'prompt' && (
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={t('input.promptPlaceholder')}
          className="w-full resize-none rounded-xl border border-ink-200 px-4 py-3 text-sm outline-none focus:border-brand-400 focus:shadow-focus dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50 dark:placeholder:text-ink-500"
        />
      )}

      {fileError && <p className="mt-2 text-xs text-red-600">{fileError}</p>}

      {/* Prompt optionnel pour fichier / URL. */}
      {mode !== 'prompt' && (
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('input.optionalPrompt')}
          className="mt-3 w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:shadow-focus dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50 dark:placeholder:text-ink-500"
        />
      )}

      <div className="mt-4 flex justify-end">
        <Button onClick={submit} disabled={!canSubmit} loading={loading}>
          {t('input.analyze')}
        </Button>
      </div>
    </div>
  )
}
