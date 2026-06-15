// Hook du fil de conversation actif : chargement, envoi optimiste (3 chemins), streaming, retry.
import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useConversations } from '../contexts/ConversationsContext'
import { useI18n } from '../contexts/I18nContext'
import * as api from '../services/api'
import type { ClientMessage, PendingAttachment } from '../types'
import { useChatStream } from './useChatStream'
import { useNotifications } from './useNotifications'

interface UseConversationReturn {
  messages: ClientMessage[]
  loading: boolean
  sending: boolean
  streaming: boolean
  streamingText: string
  notFound: boolean
  /** Progression du téléversement du fichier en cours (0–100), null hors envoi de fichier. */
  uploadPct: number | null
  send: (text: string, attachment: PendingAttachment | null) => Promise<void>
  retry: () => Promise<void>
  stopStreaming: () => void
  /** Interrompt l'analyse non-streamée en cours (bouton Stop). */
  stopAnalysis: () => void
  /** Conversation à laquelle se rattache l'analyse en cours (null si aucune). */
  analyzingConversationId: string | null
  /** Conversations dont une analyse tourne en tâche de fond (suivies même hors de l'écran). */
  pendingAnalysisIds: string[]
  /** Conversation à laquelle se rattache la réponse en streaming en cours (null si aucune). */
  streamingConversationId: string | null
  /** Message de quota de forfait atteint (soft-block) ; null si aucun. */
  quotaError: string | null
  /** Efface l'alerte de quota. */
  clearQuotaError: () => void
}

export function useConversation(
  conversationId: string | undefined,
  navigateToConversation: (id: string) => void
): UseConversationReturn {
  const { create, touch } = useConversations()
  const { lang, t } = useI18n()
  const stream = useChatStream()
  const { notify } = useNotifications()

  const [messages, setMessages] = useState<ClientMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [quotaError, setQuotaError] = useState<string | null>(null)
  // Conversation à laquelle se rattache l'analyse en cours : l'indicateur de progression n'est
  // affiché que pour CETTE conversation (sinon il fuiterait dans les autres discussions).
  const [analyzingConversationId, setAnalyzingConversationId] = useState<string | null>(null)
  // Idem pour la réponse en streaming (sert à proposer une notification si on a changé de conversation).
  const [streamingConversationId, setStreamingConversationId] = useState<string | null>(null)
  // Analyses en tâche de fond en cours (toutes conversations confondues), pour proposer une
  // notification quand l'utilisateur n'est pas sur la conversation concernée.
  const [pendingAnalysisIds, setPendingAnalysisIds] = useState<string[]>([])

  // Conversation créée localement : le rechargement qui suit la navigation est sauté
  // pour ne pas écraser les messages optimistes.
  const justCreatedRef = useRef<string | null>(null)
  // Dernier envoi en échec, rejouable via retry().
  const lastFailedRef = useRef<{ text: string; attachment: PendingAttachment | null } | null>(null)
  // Contrôleur d'annulation du TÉLÉVERSEMENT en cours (le Stop pendant l'upload annule la requête ;
  // une fois l'analyse en tâche de fond démarrée, le Stop passe par l'endpoint d'annulation serveur).
  const analysisAbortRef = useRef<AbortController | null>(null)
  // Sondages d'analyses en tâche de fond, par conversation. Ils survivent à la navigation (un job
  // lancé reste suivi jusqu'à sa fin pour pouvoir notifier), et sont tous arrêtés au démontage.
  const pollersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  // Conversations vues « en cours » : sert à ne notifier qu'à la TRANSITION en cours → terminé.
  const wasPendingRef = useRef<Set<string>>(new Set())
  // Conversation actuellement affichée : permet, au retour d'une analyse, de n'appliquer la
  // mise à jour qu'à la bonne discussion (l'utilisateur a pu naviguer ailleurs entre-temps).
  const currentConversationRef = useRef<string | undefined>(conversationId)
  useEffect(() => {
    currentConversationRef.current = conversationId
  }, [conversationId])

  // Arrête tous les sondages au démontage (fermeture de l'app).
  useEffect(() => {
    const pollers = pollersRef.current
    return () => {
      for (const handle of pollers.values()) clearInterval(handle)
      pollers.clear()
    }
  }, [])

  // Réconcilie l'état client avec le fil renvoyé par le serveur. La carte d'analyse « pending »
  // n'est PAS affichée comme une carte : elle pilote l'indicateur de progression (sending). À la
  // transition en cours → terminé, on notifie si la conversation n'est pas au premier plan.
  // Retourne true tant qu'une analyse reste en cours (le sondeur s'arrête sinon).
  const applyConversation = useCallback(
    (id: string, conversation: { title: string }, serverMessages: ClientMessage[]): boolean => {
      const pending = serverMessages.some(
        (m) => m.kind === 'analysis' && m.analysisStatus === 'pending'
      )
      const isActive = currentConversationRef.current === id

      // Suivi global des analyses en cours (notification « hors écran »).
      setPendingAnalysisIds((prev) => {
        const has = prev.includes(id)
        if (pending && !has) return [...prev, id]
        if (!pending && has) return prev.filter((p) => p !== id)
        return prev
      })

      if (isActive) {
        // Cartes « pending » masquées (remplacées par l'indicateur) ; cartes « error » conservées
        // (rendues comme un échec d'analyse).
        setMessages(serverMessages.filter((m) => !(m.kind === 'analysis' && m.analysisStatus === 'pending')))
        setSending(pending)
        if (pending) setAnalyzingConversationId(id)
        else setAnalyzingConversationId((cur) => (cur === id ? null : cur))
      }

      const wasPending = wasPendingRef.current.has(id)
      if (pending) {
        wasPendingRef.current.add(id)
      } else if (wasPending) {
        wasPendingRef.current.delete(id)
        // La liste latérale peut avoir été renommée d'après la description : on rafraîchit.
        touch(id, conversation.title)
        // Notifie seulement si la conversation n'est pas ouverte au premier plan.
        if (!isActive || document.hidden) {
          notify(t('notify.analysisReady'), {
            body: t('notify.body'),
            onClick: () => navigateToConversation(id),
          })
        }
      }
      return pending
    },
    [navigateToConversation, notify, t, touch]
  )

  // Un tour de sondage : récupère le fil et s'arrête dès que l'analyse est terminée.
  const pollOnce = useCallback(
    async (id: string): Promise<void> => {
      try {
        const { conversation, messages: loaded } = await api.getConversation(id)
        const stillPending = applyConversation(id, conversation, loaded)
        if (!stillPending) {
          const handle = pollersRef.current.get(id)
          if (handle) {
            clearInterval(handle)
            pollersRef.current.delete(id)
          }
        }
      } catch {
        // Erreur transitoire : on conserve le sondage (le job tourne toujours côté serveur).
      }
    },
    [applyConversation]
  )

  // Démarre le suivi d'une analyse en tâche de fond (idempotent par conversation).
  const startPolling = useCallback(
    (id: string): void => {
      if (pollersRef.current.has(id)) return
      const handle = setInterval(() => {
        void pollOnce(id)
      }, 2500)
      pollersRef.current.set(id, handle)
    },
    [pollOnce]
  )

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      setNotFound(false)
      return
    }
    if (justCreatedRef.current === conversationId) {
      justCreatedRef.current = null
      return
    }
    const id = conversationId
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    api
      .getConversation(id)
      .then(({ conversation, messages: loaded }) => {
        if (cancelled) return
        // Reprise au reload : si une analyse était en cours, l'indicateur réapparaît et le suivi reprend.
        const pending = applyConversation(id, conversation, loaded)
        if (pending) startPolling(id)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [conversationId, applyConversation, startPolling])

  const doSend = useCallback(
    async (text: string, attachment: PendingAttachment | null): Promise<void> => {
      if (sending || stream.streaming) return

      // Message optimiste affiché immédiatement (avant même la création de la conversation).
      const attachmentName =
        attachment?.kind === 'file' ? attachment.file.name : (attachment?.url ?? null)
      const tempId = nanoid()
      const optimistic: ClientMessage = {
        id: tempId,
        role: 'user',
        kind: 'text',
        content: text,
        attachmentName,
        seq: Number.MAX_SAFE_INTEGER,
        createdAt: new Date().toISOString(),
        analysis: null,
        analysisStatus: 'ready',
        status: 'sending',
      }
      setMessages((prev) => [...prev, optimistic])

      // Création paresseuse de la conversation au premier envoi (la route unique évite le remontage).
      let id = conversationId
      if (!id) {
        try {
          const conversation = await create()
          id = conversation.id
          justCreatedRef.current = id
          navigateToConversation(id)
        } catch {
          // Échec de création : l'envoi est marqué en erreur et rejouable.
          lastFailedRef.current = { text, attachment }
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m))
          )
          return
        }
      }

      // Seule une analyse RÉUSSIE permet le chat de suivi (une carte en échec n'a pas d'analyse
      // persistée : un suivi serait rejeté côté serveur). On reste alors sur le chemin analyse.
      const hasAnalysis = messages.some((m) => m.kind === 'analysis' && m.analysisStatus === 'ready')
      const isChatPath = !attachment && hasAnalysis

      if (isChatPath) {
        // Chemin streaming : le message user est persisté server-side avant le flux.
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: undefined } : m))
        )
        setStreamingConversationId(id)
        const outcome = await stream.start(id, text, lang)

        if (outcome.text) {
          // Réponse complète ou partielle : matérialisée dans le fil.
          setMessages((prev) => [
            ...prev,
            {
              id: outcome.messageId ?? nanoid(),
              role: 'assistant',
              kind: 'text',
              content: outcome.text,
              attachmentName: null,
              seq: Number.MAX_SAFE_INTEGER,
              createdAt: new Date().toISOString(),
              analysis: null,
              analysisStatus: 'ready',
              status: outcome.messageId ? undefined : 'interrupted',
            },
          ])
          touch(id)
          // Conversation plus ouverte à la fin du flux : on prévient (si l'utilisateur l'a autorisé).
          if (currentConversationRef.current !== id) {
            notify(t('notify.answerReady'), {
              body: t('notify.body'),
              onClick: () => navigateToConversation(id),
            })
          }
        } else if (outcome.error) {
          // Aucun token reçu : l'envoi est marqué en échec et rejouable.
          lastFailedRef.current = { text, attachment }
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m))
          )
        }
        stream.reset()
        setStreamingConversationId(null)
        return
      }

      // Chemin analyse (fichier, URL ou premier prompt) : lancée en TÂCHE DE FOND côté serveur.
      // Le POST persiste l'échange (carte « pending ») et répond aussitôt ; l'analyse continue
      // ensuite indépendamment de la requête HTTP et survit donc au reload. On suit par sondage.
      setSending(true)
      setAnalyzingConversationId(id)
      if (attachment?.kind === 'file') setUploadPct(0)
      // Le contrôleur n'annule QUE le téléversement (avant que le job ne démarre) ; une fois la
      // tâche de fond lancée, le Stop passe par l'endpoint d'annulation serveur.
      const ac = new AbortController()
      analysisAbortRef.current = ac
      try {
        const result = await api.sendConversationMessage(
          id,
          {
            text: text || undefined,
            file: attachment?.kind === 'file' ? attachment.file : undefined,
            url: attachment?.kind === 'url' ? attachment.url : undefined,
            lang,
          },
          attachment?.kind === 'file' ? setUploadPct : undefined,
          ac.signal
        )
        analysisAbortRef.current = null
        lastFailedRef.current = null
        // Affiche la question + la carte « pending » (masquée → indicateur) et démarre le suivi.
        // Le suivi continue même si l'utilisateur navigue ailleurs (notification à la fin).
        const pending = applyConversation(id, result.conversation, result.messages)
        // Cas limite : analyse déjà terminée à la réponse du POST → inutile de sonder.
        if (pending) startPolling(id)
      } catch (err) {
        analysisAbortRef.current = null
        const code = (err as { code?: string } | null)?.code
        const stillHere = currentConversationRef.current === id
        setSending(false)
        setAnalyzingConversationId((cur) => (cur === id ? null : cur))
        if (ac.signal.aborted) {
          // Stop pendant le téléversement : le job n'a pas démarré, on retire simplement l'optimiste.
          if (stillHere) setMessages((prev) => prev.filter((m) => m.id !== tempId))
        } else if (code === 'QUOTA_EXCEEDED') {
          // Quota de forfait atteint : on retire le message optimiste et on présente une invitation
          // à monter en gamme (soft-block), plutôt qu'une erreur rejouable qui échouerait à nouveau.
          if (stillHere) {
            setMessages((prev) => prev.filter((m) => m.id !== tempId))
            setQuotaError((err as { message?: string } | null)?.message ?? 'Quota atteint.')
          }
        } else if (stillHere) {
          lastFailedRef.current = { text, attachment }
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m)))
        }
      } finally {
        // sending/analyzing NE sont PAS réinitialisés ici : l'analyse continue en tâche de fond
        // (c'est le sondeur qui les remettra à zéro à la fin). On ne nettoie que l'upload.
        setUploadPct(null)
      }
    },
    [
      applyConversation,
      conversationId,
      create,
      lang,
      messages,
      navigateToConversation,
      notify,
      sending,
      startPolling,
      stream,
      t,
      touch,
    ]
  )

  // Bouton Stop. Pendant le téléversement : annule la requête (le job n'a pas démarré). Sinon
  // l'analyse tourne en tâche de fond → annulation EXPLICITE côté serveur (qui supprime l'échange).
  const stopAnalysis = useCallback(() => {
    if (analysisAbortRef.current) {
      analysisAbortRef.current.abort()
      return
    }
    const id = analyzingConversationId ?? conversationId
    if (!id) return
    setSending(false)
    setAnalyzingConversationId((cur) => (cur === id ? null : cur))
    setPendingAnalysisIds((prev) => prev.filter((p) => p !== id))
    // Supprime le suivi du « terminé » pour ne pas notifier une fin qui est en réalité une annulation.
    wasPendingRef.current.delete(id)
    void api
      .cancelAnalysis(id)
      .then(() => pollOnce(id))
      .catch(() => undefined)
  }, [analyzingConversationId, conversationId, pollOnce])

  const clearQuotaError = useCallback(() => setQuotaError(null), [])

  const retry = useCallback(async () => {
    const failed = lastFailedRef.current
    if (!failed) return
    lastFailedRef.current = null
    // Retire le message en échec avant de rejouer l'envoi.
    setMessages((prev) => prev.filter((m) => m.status !== 'error'))
    await doSend(failed.text, failed.attachment)
  }, [doSend])

  return {
    messages,
    loading,
    sending,
    streaming: stream.streaming,
    streamingText: stream.text,
    notFound,
    uploadPct,
    send: doSend,
    retry,
    stopStreaming: stream.stop,
    stopAnalysis,
    analyzingConversationId,
    pendingAnalysisIds,
    streamingConversationId,
    quotaError,
    clearQuotaError,
  }
}
