// Page de chat (accueil) : héros de dépôt sur conversation vierge, fil + composer ensuite.
// Route unique « c?/:conversationId? » : la création d'une conversation au premier envoi
// navigue vers /c/:id sans remonter le composant (l'état optimiste survit).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { AnalyzingPreview } from '../components/chat/AnalyzingIndicator'
import { ChatThread } from '../components/chat/ChatThread'
import { Composer } from '../components/chat/Composer'
import { NewConversationHero } from '../components/chat/NewConversationHero'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { useI18n } from '../contexts/I18nContext'
import { useConversation } from '../hooks/useConversation'
import { useNotifications } from '../hooks/useNotifications'
import { usePlan } from '../hooks/usePlan'
import * as api from '../services/api'
import type { PendingAttachment } from '../types'
import {
  getVideoDuration,
  getVideoThumbnail,
  isVideoFile,
  validateFile,
  VIDEO_MAX_DURATION_S,
} from '../utils/fileHelpers'
import { isVideoAttachment, isVideoPlatformUrl, youtubeThumbnailUrl } from '../utils/videoUrl'

export function ChatPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { conversationId } = useParams<{ conversationId?: string }>()

  const navigateToConversation = useCallback(
    (id: string) => navigate(`/c/${id}`, { replace: true }),
    [navigate]
  )

  const thread = useConversation(conversationId, navigateToConversation)
  const { fileLimits } = usePlan()
  const { permission: notifPermission, request: requestNotif } = useNotifications()
  const [notifOfferDismissed, setNotifOfferDismissed] = useState(false)

  // Opération (analyse ou réponse) en cours dans une conversation qui n'est PAS celle affichée :
  // c'est le seul cas où l'on propose une notification « quand ce sera prêt ». Les analyses
  // tournent en tâche de fond et restent suivies même après navigation (pendingAnalysisIds).
  const awayConversationId =
    (thread.pendingAnalysisIds.find((id) => id !== conversationId) ?? null) ??
    (thread.streaming && thread.streamingConversationId !== conversationId
      ? thread.streamingConversationId
      : null)

  // L'invite réapparaît à chaque nouvelle opération « hors conversation ».
  useEffect(() => {
    if (!awayConversationId) setNotifOfferDismissed(false)
  }, [awayConversationId])

  const showNotifOffer = Boolean(awayConversationId) && notifPermission === 'default' && !notifOfferDismissed

  const [attachment, setAttachment] = useState<PendingAttachment | null>(null)
  const [checking, setChecking] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  // Aperçu du média en cours d'analyse (affiché par l'indicateur de progression).
  const [analyzingPreview, setAnalyzingPreview] = useState<AnalyzingPreview | null>(null)
  // Service saturé : une file d'attente de calcul est active côté passerelle (sondée pendant l'analyse).
  const [analyzeBusy, setAnalyzeBusy] = useState(false)

  // Pendant une analyse, on sonde périodiquement la charge de la passerelle afin d'avertir
  // l'utilisateur si le service est saturé (allocation de capacité, file d'attente de calcul).
  useEffect(() => {
    if (!thread.sending) {
      setAnalyzeBusy(false)
      return
    }
    let active = true
    const poll = (): void => {
      void api
        .getCapacity()
        .then((c) => {
          if (active) setAnalyzeBusy(c.queued > 0)
        })
        .catch(() => undefined)
    }
    poll()
    const id = window.setInterval(poll, 4000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [thread.sending])

  // Les URLs d'objet sont gérées manuellement : l'aperçu survit au transfert
  // pièce jointe → indicateur d'analyse, puis est révoqué en fin d'analyse.
  const revokeAttachmentUrl = useCallback((target: PendingAttachment | null) => {
    if (target?.kind === 'file' && target.previewUrl) URL.revokeObjectURL(target.previewUrl)
  }, [])

  const replaceAttachment = useCallback((next: PendingAttachment | null) => {
    setAttachment((prev) => {
      // Ne pas révoquer un object URL réutilisé tel quel par la nouvelle pièce jointe :
      // la mise à jour des métadonnées d'une vidéo conserve le même aperçu (le révoquer
      // casserait la lecture dans le héros et l'indicateur d'analyse).
      const prevUrl = prev?.kind === 'file' ? prev.previewUrl : null
      const nextUrl = next?.kind === 'file' ? next.previewUrl : null
      if (prevUrl && prevUrl !== nextUrl) URL.revokeObjectURL(prevUrl)
      return next
    })
  }, [])

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
  useEffect(() => {
    return () => {
      revokeAttachmentUrl(attachmentRef.current)
      setAttachment(null)
      setAttachmentError(null)
    }
  }, [conversationId, revokeAttachmentUrl])

  async function attachFile(file: File): Promise<void> {
    setAttachmentError(null)
    const check = validateFile(file, fileLimits)
    if (!check.valid) {
      replaceAttachment(null)
      setAttachmentError(
        check.reason === 'videoSize'
          ? t('input.videoTooLarge', { mb: fileLimits.maxVideoMb })
          : check.reason === 'imageSize'
            ? t('input.imageTooLarge', { mb: fileLimits.maxImageMb })
            : t('input.fileError')
      )
      return
    }

    const previewUrl = URL.createObjectURL(file)
    if (isVideoFile(file)) {
      // Durée vérifiée via les métadonnées avant d'autoriser l'envoi (≤ 5 minutes).
      setChecking(true)
      // Aperçu : icône le temps de générer la première image, puis vignette + durée.
      replaceAttachment({ kind: 'file', file, previewUrl, thumbnailUrl: null, isVideo: true })
      try {
        const duration = await getVideoDuration(file)
        if (duration > VIDEO_MAX_DURATION_S) {
          replaceAttachment(null)
          setAttachmentError(t('input.videoTooLong'))
          return
        }
        const thumbnailUrl = await getVideoThumbnail(file)
        replaceAttachment({
          kind: 'file',
          file,
          previewUrl,
          thumbnailUrl,
          isVideo: true,
          durationS: duration,
        })
      } catch {
        // Métadonnées illisibles : le serveur tranchera (garde de durée côté dyper-ai).
      } finally {
        setChecking(false)
      }
      return
    }

    // Image : l'object URL sert directement de vignette.
    replaceAttachment({ kind: 'file', file, previewUrl, thumbnailUrl: previewUrl, isVideo: false })
  }

  function attachUrl(url: string): void {
    setAttachmentError(null)
    // YouTube : miniature déduite instantanément ; Twitch/VOD : résolue côté serveur (asynchrone).
    const ytThumbnail = youtubeThumbnailUrl(url)
    replaceAttachment({ kind: 'url', url, thumbnailUrl: ytThumbnail })
    if (!ytThumbnail && isVideoPlatformUrl(url)) {
      void api.fetchVideoThumbnail(url).then((thumbnailUrl) => {
        if (!thumbnailUrl) return
        // Ne mettre à jour que si c'est toujours la même URL collée.
        setAttachment((prev) =>
          prev?.kind === 'url' && prev.url === url ? { ...prev, thumbnailUrl } : prev
        )
      })
    }
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
        thumbnailUrl: current.thumbnailUrl,
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

  // L'indicateur d'analyse n'est montré que dans la discussion où l'analyse a été lancée
  // (corrige la fuite de l'encadré de progression vers les autres conversations).
  const analyzingHere = thread.sending && thread.analyzingConversationId === conversationId

  // Message utilisateur ayant déclenché l'analyse en cours (le dernier message « user » du fil).
  // Au reload / retour sur la conversation, l'aperçu local est perdu : on reconstruit l'essentiel
  // (type de média via le nom de la pièce jointe, instant de départ via la date du message) afin
  // que l'indicateur reste cohérent — frise vidéo en 4 étapes, barre et ETA calées sur le serveur.
  const pendingUserMessage = useMemo(() => {
    if (!analyzingHere) return null
    return [...thread.messages].reverse().find((m) => m.role === 'user') ?? null
  }, [analyzingHere, thread.messages])

  const fallbackPreview = useMemo<AnalyzingPreview | null>(() => {
    if (!analyzingHere || analyzingPreview || !pendingUserMessage) return null
    return {
      url: null,
      isVideo: isVideoAttachment(pendingUserMessage.attachmentName),
      name: pendingUserMessage.attachmentName,
      durationS: null,
    }
  }, [analyzingHere, analyzingPreview, pendingUserMessage])

  const indicatorPreview = analyzingPreview ?? fallbackPreview
  // Calage serveur seulement en l'absence d'aperçu local (reload / retour) : sinon l'envoi frais
  // garde son horloge locale (qui démarre proprement à la fin du téléversement).
  const analysisStartedAt =
    !analyzingPreview && pendingUserMessage ? Date.parse(pendingUserMessage.createdAt) : null

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
            sending={analyzingHere}
            streaming={thread.streaming}
            streamingText={thread.streamingText}
            analyzingPreview={indicatorPreview}
            uploadPct={thread.uploadPct}
            analysisStartedAt={analysisStartedAt}
            onRetry={() => void thread.retry()}
            onDropFile={(file) => void attachFile(file)}
            analyzeBusy={analyzeBusy}
          />
          {thread.quotaError && (
            <div className="mx-auto mb-2 flex w-full max-w-3xl items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <svg className="h-5 w-5 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  {t('quota.title')}
                </p>
                <p className="truncate text-xs text-amber-700/90 dark:text-amber-300/90">
                  {thread.quotaError}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/pricing')}
                className="shrink-0 rounded-lg bg-gradient-to-r from-blue-500 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                {t('quota.cta')}
              </button>
              <button
                type="button"
                onClick={thread.clearQuotaError}
                aria-label={t('quota.dismiss')}
                className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}
          <Composer
            busy={analyzingHere || thread.streaming || thread.loading}
            stoppable={analyzingHere || thread.streaming}
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
            onStop={thread.streaming ? thread.stopStreaming : thread.stopAnalysis}
          />
        </>
      )}

      {/* Invite à activer une notification : uniquement quand un traitement tourne dans une AUTRE
          conversation que celle affichée. Disparaît dès qu'on a choisi (ou à la fin de l'opération). */}
      {showNotifOffer && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="surface pointer-events-auto flex items-center gap-3 px-4 py-3 shadow-card-hover">
            <svg className="h-5 w-5 shrink-0 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            <p className="text-sm text-ink-700 dark:text-ink-200">{t('notify.offer')}</p>
            <button
              type="button"
              onClick={() => void requestNotif()}
              className="shrink-0 rounded-lg bg-gradient-to-r from-blue-500 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {t('notify.enable')}
            </button>
            <button
              type="button"
              onClick={() => setNotifOfferDismissed(true)}
              aria-label={t('notify.dismiss')}
              className="shrink-0 text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
