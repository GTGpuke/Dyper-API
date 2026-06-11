// Page de chat (accueil) : héros de dépôt sur conversation vierge, fil + composer ensuite.
// Route unique « c?/:conversationId? » : la création d'une conversation au premier envoi
// navigue vers /c/:id sans remonter le composant (l'état optimiste survit).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { AnalyzingPreview } from '../components/chat/AnalyzingIndicator'
import { ChatThread } from '../components/chat/ChatThread'
import { Composer } from '../components/chat/Composer'
import { NewConversationHero } from '../components/chat/NewConversationHero'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { useI18n } from '../contexts/I18nContext'
import { useConversation } from '../hooks/useConversation'
import type { PendingAttachment } from '../types'
import {
  getVideoDuration,
  isVideoFile,
  validateFile,
  VIDEO_MAX_DURATION_S,
} from '../utils/fileHelpers'
import { isVideoPlatformUrl } from '../utils/videoUrl'

export function ChatPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { conversationId } = useParams<{ conversationId?: string }>()

  const navigateToConversation = useCallback(
    (id: string) => navigate(`/c/${id}`, { replace: true }),
    [navigate]
  )

  const thread = useConversation(conversationId, navigateToConversation)

  const [attachment, setAttachment] = useState<PendingAttachment | null>(null)
  const [checking, setChecking] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  // Aperçu du média en cours d'analyse (affiché par l'indicateur de progression).
  const [analyzingPreview, setAnalyzingPreview] = useState<AnalyzingPreview | null>(null)

  // Les URLs d'objet sont gérées manuellement : l'aperçu survit au transfert
  // pièce jointe → indicateur d'analyse, puis est révoqué en fin d'analyse.
  const revokeAttachmentUrl = useCallback((target: PendingAttachment | null) => {
    if (target?.kind === 'file' && target.previewUrl) URL.revokeObjectURL(target.previewUrl)
  }, [])

  const replaceAttachment = useCallback(
    (next: PendingAttachment | null) => {
      setAttachment((prev) => {
        revokeAttachmentUrl(prev)
        return next
      })
    },
    [revokeAttachmentUrl]
  )

  // Fin d'analyse : l'aperçu transféré est révoqué.
  useEffect(() => {
    if (thread.sending) return
    setAnalyzingPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url)
      return null
    })
  }, [thread.sending])

  // Démontage et changement de conversation : tout est nettoyé.
  const attachmentRef = useRef(attachment)
  attachmentRef.current = attachment
  // biome-ignore lint/correctness/useExhaustiveDependencies: réinitialisation volontaire par fil.
  useEffect(() => {
    return () => {
      revokeAttachmentUrl(attachmentRef.current)
      setAttachment(null)
      setAttachmentError(null)
    }
  }, [conversationId, revokeAttachmentUrl])

  async function attachFile(file: File): Promise<void> {
    setAttachmentError(null)
    const check = validateFile(file)
    if (!check.valid) {
      replaceAttachment(null)
      setAttachmentError(check.reason === 'videoSize' ? t('input.videoTooLarge') : t('input.fileError'))
      return
    }

    const previewUrl = URL.createObjectURL(file)
    if (isVideoFile(file)) {
      // Durée vérifiée via les métadonnées avant d'autoriser l'envoi (≤ 5 minutes).
      setChecking(true)
      replaceAttachment({ kind: 'file', file, previewUrl, isVideo: true })
      try {
        const duration = await getVideoDuration(file)
        if (duration > VIDEO_MAX_DURATION_S) {
          replaceAttachment(null)
          setAttachmentError(t('input.videoTooLong'))
          return
        }
        replaceAttachment({ kind: 'file', file, previewUrl, isVideo: true, durationS: duration })
      } catch {
        // Métadonnées illisibles : le serveur tranchera (garde de durée côté dyper-ai).
      } finally {
        setChecking(false)
      }
      return
    }

    replaceAttachment({ kind: 'file', file, previewUrl, isVideo: false })
  }

  function attachUrl(url: string): void {
    setAttachmentError(null)
    replaceAttachment({ kind: 'url', url })
  }

  async function handleSend(text: string): Promise<void> {
    const current = attachment
    setAttachmentError(null)
    if (current?.kind === 'file') {
      // L'aperçu est transféré à l'indicateur d'analyse (révoqué en fin d'envoi).
      setAnalyzingPreview({
        url: current.previewUrl,
        isVideo: current.isVideo,
        name: current.file.name,
        durationS: current.durationS ?? null,
      })
      setAttachment(null)
    } else {
      if (current?.kind === 'url' && isVideoPlatformUrl(current.url)) {
        // Lien YouTube/Twitch : pas d'aperçu local, mais l'indicateur sait que c'est long.
        setAnalyzingPreview({ url: null, isVideo: true, name: current.url, durationS: null })
      }
      replaceAttachment(null)
    }
    await thread.send(text, current)
  }

  if (thread.notFound) {
    return (
      <div className="grid h-full place-items-center px-4">
        <EmptyState
          title={t('chat.notFound')}
          action={
            <Button size="sm" onClick={() => navigate('/')}>
              {t('chat.new')}
            </Button>
          }
        />
      </div>
    )
  }

  // Conversation vierge : héros de dépôt plein écran (sans le fil).
  const showHero =
    !thread.loading &&
    thread.messages.length === 0 &&
    !thread.sending &&
    !thread.streaming

  return (
    <div className="flex h-full flex-col">
      {showHero ? (
        // Mode héros : le composer n'est pas rendu — le héros absorbe toutes les entrées
        // (fichier, URL, texte libre, question optionnelle).
        <NewConversationHero
          attachment={attachment}
          checking={checking}
          error={attachmentError}
          analyzeDisabled={thread.sending || thread.loading}
          onPickFile={(file) => void attachFile(file)}
          onAttachUrl={attachUrl}
          onRemoveAttachment={() => {
            replaceAttachment(null)
            setAttachmentError(null)
          }}
          onSubmit={(text) => void handleSend(text)}
        />
      ) : (
        <>
          <ChatThread
            messages={thread.messages}
            loading={thread.loading}
            sending={thread.sending}
            streaming={thread.streaming}
            streamingText={thread.streamingText}
            analyzingPreview={analyzingPreview}
            uploadPct={thread.uploadPct}
            onRetry={() => void thread.retry()}
            onDropFile={(file) => void attachFile(file)}
          />
          <Composer
            disabled={thread.sending || thread.loading}
            streaming={thread.streaming}
            attachment={attachment}
            attachmentChecking={checking}
            attachmentError={attachmentError}
            onAttachFile={(file) => void attachFile(file)}
            onAttachUrl={attachUrl}
            onRemoveAttachment={() => {
              replaceAttachment(null)
              setAttachmentError(null)
            }}
            onSend={(text) => void handleSend(text)}
            onStop={thread.stopStreaming}
          />
        </>
      )}
    </div>
  )
}
