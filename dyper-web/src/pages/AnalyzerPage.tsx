// Page principale : saisie multimodale, résultat annoté et chat de suivi.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { InputPanel } from '../components/analyzer/InputPanel'
import { ResultPanel } from '../components/result/ResultPanel'
import { FollowUpChat } from '../components/analyzer/FollowUpChat'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Button } from '../components/ui/Button'
import { useAnalyze, type AnalyzeInput } from '../hooks/useAnalyze'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'

export function AnalyzerPage() {
  const { settings } = useAuth()
  const { t } = useI18n()
  const { status, result, error, run, reset } = useAnalyze()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  function handleSubmit(input: AnalyzeInput, preview: string | null): void {
    setPreviewUrl(preview)
    // Applique la langue de réponse par défaut du compte si l'utilisateur n'en a pas fixé d'autre.
    void run({ ...input, lang: input.lang ?? settings.analysis.defaultLang })
  }

  function handleReset(): void {
    reset()
    setPreviewUrl(null)
  }

  return (
    <div>
      <PageHeader
        title={t('analyzer.title')}
        subtitle={t('analyzer.subtitle')}
        actions={
          result ? (
            <Button variant="secondary" size="sm" onClick={handleReset}>
              {t('analyzer.new')}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-6">
        {!result && (
          <InputPanel
            loading={status === 'loading'}
            defaultMode={settings.analysis.defaultType}
            onSubmit={handleSubmit}
          />
        )}

        {error && <ErrorBanner error={error} />}

        {result && (
          <>
            <div className="surface p-6">
              <ResultPanel result={result} previewUrl={previewUrl} />
            </div>
            <FollowUpChat context={result} />
            <p className="text-center text-xs text-ink-400 dark:text-ink-500">
              {t('analyzer.savedHint')}
              <Link to="/history" className="text-brand-600 hover:underline">
                {t('analyzer.savedHintLink')}
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  )
}
