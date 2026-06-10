// Réponse texte de l'assistant : texte brut préservant les sauts de ligne, caret en streaming.
// Point unique de rendu du texte assistant (un éventuel rendu markdown se brancherait ici).
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'

export function AssistantText({
  content,
  streaming = false,
  interrupted = false,
}: {
  content: string
  streaming?: boolean
  interrupted?: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="max-w-2xl">
      <p
        className={cn(
          'whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-700 dark:text-ink-200'
        )}
      >
        {content}
        {streaming && (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-ink-400 align-middle dark:bg-ink-500" />
        )}
      </p>
      {interrupted && (
        <p className="mt-1 text-xs italic text-ink-400 dark:text-ink-500">{t('chat.interrupted')}</p>
      )}
    </div>
  )
}
