// Bulle de message utilisateur : texte + pastille de pièce jointe + états d'envoi/erreur.
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { ClientMessage } from '../../types'
import { Spinner } from '../ui/Spinner'

export function MessageBubble({
  message,
  onRetry,
}: {
  message: ClientMessage
  onRetry: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className={cn(
          'max-w-[85%] rounded-2xl bg-brand-600 px-4 py-2.5 text-[15px] leading-relaxed text-white sm:max-w-[70%]',
          message.status === 'sending' && 'opacity-70',
          message.status === 'error' && 'ring-2 ring-red-400'
        )}
      >
        {message.attachmentName && (
          <span className="mb-1 flex items-center gap-1.5 rounded-lg bg-white/15 px-2 py-1 text-xs">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="truncate">{message.attachmentName}</span>
          </span>
        )}
        {message.content && <span className="whitespace-pre-wrap break-words">{message.content}</span>}
      </div>

      {message.status === 'sending' && (
        <span className="flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-500">
          <Spinner className="h-3 w-3" />
        </span>
      )}
      {message.status === 'error' && (
        <span className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          {t('chat.sendError')}
          <button type="button" onClick={onRetry} className="font-medium underline">
            {t('chat.retry')}
          </button>
        </span>
      )}
    </div>
  )
}
