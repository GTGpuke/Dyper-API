// Hook du fil de conversation actif : chargement, envoi optimiste (3 chemins), streaming, retry.
import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useConversations } from '../contexts/ConversationsContext'
import { useI18n } from '../contexts/I18nContext'
import * as api from '../services/api'
import type { ClientMessage, PendingAttachment } from '../types'
import { useChatStream } from './useChatStream'

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
}

export function useConversation(
  conversationId: string | undefined,
  navigateToConversation: (id: string) => void
): UseConversationReturn {
  const { create, touch } = useConversations()
  const { lang } = useI18n()
  const stream = useChatStream()

  const [messages, setMessages] = useState<ClientMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [uploadPct, setUploadPct] = useState<number | null>(null)

  // Conversation créée localement : le rechargement qui suit la navigation est sauté
  // pour ne pas écraser les messages optimistes.
  const justCreatedRef = useRef<string | null>(null)
  // Dernier envoi en échec, rejouable via retry().
  const lastFailedRef = useRef<{ text: string; attachment: PendingAttachment | null } | null>(null)

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
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    api
      .getConversation(conversationId)
      .then(({ messages: loaded }) => {
        if (!cancelled) setMessages(loaded)
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
  }, [conversationId])

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

      const hasAnalysis = messages.some((m) => m.kind === 'analysis')
      const isChatPath = !attachment && hasAnalysis

      if (isChatPath) {
        // Chemin streaming : le message user est persisté server-side avant le flux.
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: undefined } : m))
        )
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
              status: outcome.messageId ? undefined : 'interrupted',
            },
          ])
          touch(id)
        } else if (outcome.error) {
          // Aucun token reçu : l'envoi est marqué en échec et rejouable.
          lastFailedRef.current = { text, attachment }
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m))
          )
        }
        stream.reset()
        return
      }

      // Chemin analyse (fichier, URL ou premier prompt) : endpoint non-streamé.
      setSending(true)
      if (attachment?.kind === 'file') setUploadPct(0)
      try {
        const result = await api.sendConversationMessage(
          id,
          {
            text: text || undefined,
            file: attachment?.kind === 'file' ? attachment.file : undefined,
            url: attachment?.kind === 'url' ? attachment.url : undefined,
            lang,
          },
          attachment?.kind === 'file' ? setUploadPct : undefined
        )
        // Remplace le message optimiste par la paire renvoyée par le serveur.
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          ...result.messages,
        ])
        touch(id, result.conversation.title)
        lastFailedRef.current = null
      } catch {
        lastFailedRef.current = { text, attachment }
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m))
        )
      } finally {
        setSending(false)
        setUploadPct(null)
      }
    },
    [conversationId, create, lang, messages, navigateToConversation, sending, stream, touch]
  )

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
  }
}
