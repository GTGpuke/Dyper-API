// Composer du chat : textarea auto-extensible, pièce jointe, Entrée pour envoyer.
// Une analyse et une demande au LLM sont traitées de façon IDENTIQUE : pendant l'une ou l'autre,
// la saisie et la pièce jointe sont désactivées, et le bouton d'envoi devient un bouton « Arrêter »
// qui interrompt l'opération en cours.
import { useRef, useState, type KeyboardEvent } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { useAutosizeTextarea } from '../../hooks/useAutosizeTextarea'
import type { PendingAttachment } from '../../types'
import { AttachMenu } from './AttachMenu'
import { AttachmentChip } from './AttachmentChip'

interface Props {
  /** Une opération est en cours (analyse, streaming ou chargement) : saisie et envoi suspendus. */
  busy: boolean
  /** L'opération en cours est interruptible : le bouton d'envoi devient « Arrêter ». */
  stoppable: boolean
  attachment: PendingAttachment | null
  attachmentChecking: boolean
  attachmentError: string | null
  onAttachFile: (file: File) => void
  onAttachUrl: (url: string) => void
  onRemoveAttachment: () => void
  onSend: (text: string) => void
  /** Interrompt l'opération en cours (analyse ou réponse du LLM). */
  onStop: () => void
}

export function Composer({
  busy,
  stoppable,
  attachment,
  attachmentChecking,
  attachmentError,
  onAttachFile,
  onAttachUrl,
  onRemoveAttachment,
  onSend,
  onStop,
}: Props) {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useAutosizeTextarea(textareaRef, draft)

  const canSend = !busy && !attachmentChecking && (draft.trim().length > 0 || !!attachment)

  function send(): void {
    if (!canSend) return
    const text = draft.trim()
    setDraft('')
    onSend(text)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    // Entrée envoie ; Maj+Entrée insère un saut de ligne ; la composition IME est respectée.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="shrink-0 border-t border-ink-200 bg-ink-50 px-4 pb-4 pt-3 dark:border-ink-800 dark:bg-ink-900">
      <div className="mx-auto w-full max-w-3xl">
        {attachmentError && (
          <p className="mb-2 text-xs text-red-600 dark:text-red-400">{attachmentError}</p>
        )}
        {attachment && (
          <div className="mb-2">
            <AttachmentChip
              attachment={attachment}
              checking={attachmentChecking}
              onRemove={onRemoveAttachment}
            />
          </div>
        )}

        <div className="surface flex items-end gap-1.5 p-2 focus-within:border-brand-400 focus-within:shadow-focus">
          <AttachMenu onPickFile={onAttachFile} onSubmitUrl={onAttachUrl} disabled={busy} />

          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={busy}
            placeholder={t('chat.composer.placeholder')}
            className="max-h-52 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-[15px] leading-relaxed text-ink-900 outline-none placeholder:text-ink-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-ink-50 dark:placeholder:text-ink-500"
          />

          {stoppable ? (
            <button
              type="button"
              onClick={onStop}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-800 text-white transition-colors hover:bg-ink-700 dark:bg-ink-200 dark:text-ink-900 dark:hover:bg-ink-300"
              aria-label={t('chat.composer.stop')}
              title={t('chat.composer.stop')}
            >
              <span className="block h-3 w-3 rounded-[2px] bg-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-brand-300 dark:disabled:bg-ink-700"
              aria-label={t('chat.composer.send')}
              title={t('chat.composer.send')}
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 10l16-8-8 16-2-6-6-2z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
