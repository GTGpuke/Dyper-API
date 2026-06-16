// Fil de messages : défilement « collé en bas », dépôt de fichier, bulle de streaming.
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { useStickToBottom } from '../../hooks/useStickToBottom'
import type { ClientMessage } from '../../types'
import { Spinner } from '../ui/Spinner'
import { AnalyzingIndicator, type AnalyzingPreview } from './AnalyzingIndicator'
import { AssistantMessage } from './AssistantMessage'
import { AssistantText } from './AssistantText'
import { MessageBubble } from './MessageBubble'
import { ScrollToBottomButton } from './ScrollToBottomButton'

interface Props {
  messages: ClientMessage[]
  loading: boolean
  sending: boolean
  streaming: boolean
  streamingText: string
  analyzingPreview: AnalyzingPreview | null
  uploadPct: number | null
  /** Instant de départ de l'analyse (epoch ms) connu côté serveur — calage stable au reload. */
  analysisStartedAt?: number | null
  onRetry: () => void
  onDropFile: (file: File) => void
  /** L'analyse affichée est en file d'attente (pas encore en traitement). */
  queued?: boolean
  /** Délai estimé (s) avant le démarrage de l'analyse quand le service est saturé ; null sinon. */
  queueEtaSeconds?: number | null
}

export function ChatThread({
  messages,
  loading,
  sending,
  streaming,
  streamingText,
  analyzingPreview,
  uploadPct,
  analysisStartedAt,
  onRetry,
  onDropFile,
  queued,
  queueEtaSeconds,
}: Props) {
  const { t } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { atBottom, follow, scrollToBottom } = useStickToBottom(scrollRef)
  const [dragging, setDragging] = useState(false)
  const dragDepthRef = useRef(0)

  // Suit le contenu (nouveaux messages, deltas de streaming) si l'utilisateur est en bas.
  useEffect(() => {
    follow()
  }, [messages.length, streamingText, sending, follow])

  // Saut instantané en bas à l'ouverture d'une conversation.
  useEffect(() => {
    if (!loading) scrollToBottom(false)
  }, [loading, scrollToBottom])

  function handleDrop(e: DragEvent): void {
    e.preventDefault()
    dragDepthRef.current = 0
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onDropFile(file)
  }

  return (
    <div
      className="relative min-h-0 flex-1"
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
    >
      <div ref={scrollRef} className="h-full overflow-y-auto" role="log">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
          {loading && (
            <div className="flex justify-center py-12">
              <Spinner className="h-6 w-6" />
            </div>
          )}

          {messages.map((message) =>
            message.role === 'user' ? (
              <MessageBubble key={message.id} message={message} onRetry={onRetry} />
            ) : (
              <AssistantMessage key={message.id} message={message} />
            )
          )}

          {/* Analyse en cours : aperçu scanné + barre de progression + étapes (l'arrêt se fait
              depuis le composer, comme pour une réponse du LLM). */}
          {sending && (
            <AnalyzingIndicator
              preview={analyzingPreview}
              uploadPct={uploadPct}
              startedAt={analysisStartedAt}
              queued={queued}
              queueEtaSeconds={queueEtaSeconds}
            />
          )}

          {/* Réponse en cours de streaming. */}
          {streaming && (
            <div className="flex items-start gap-3">
              <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4-4" strokeLinecap="round" />
                </svg>
              </span>
              <AssistantText content={streamingText} streaming />
            </div>
          )}
        </div>
      </div>

      {/* Annonce de fin de génération pour les lecteurs d'écran (jamais les deltas). */}
      <span aria-live="polite" className="sr-only">
        {!streaming && messages.length > 0 ? '' : ''}
      </span>

      {!atBottom && <ScrollToBottomButton onClick={() => scrollToBottom(true)} />}

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/90 dark:bg-brand-600/10">
          <p className="text-sm font-medium text-brand-700 dark:text-brand-300">{t('chat.drop.hint')}</p>
        </div>
      )}
    </div>
  )
}
