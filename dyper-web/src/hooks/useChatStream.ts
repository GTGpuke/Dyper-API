// Hook de consommation du flux SSE : tamponne les deltas (flush 40 ms) pour éviter un rendu
// par token, gère l'abandon (Stop, changement de conversation, démontage).
import { useCallback, useEffect, useRef, useState } from 'react'
import { streamChat } from '../services/chatStream'
import type { ApiError } from '../types'

export interface StreamOutcome {
  /** Identifiant du message persisté (null si le flux n'est pas allé au bout). */
  messageId: string | null
  /** Texte accumulé (complet ou partiel). */
  text: string
  /** Erreur survenue (null si succès ou abandon volontaire). */
  error: ApiError | null
}

interface UseChatStreamReturn {
  streaming: boolean
  text: string
  error: ApiError | null
  start: (conversationId: string, question: string, lang: string) => Promise<StreamOutcome>
  stop: () => void
  reset: () => void
}

const FLUSH_INTERVAL_MS = 40

export function useChatStream(): UseChatStreamReturn {
  const [streaming, setStreaming] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<ApiError | null>(null)

  const bufferRef = useRef('')
  const controllerRef = useRef<AbortController | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const stopFlusher = useCallback(() => {
    clearInterval(flushTimerRef.current)
    flushTimerRef.current = undefined
  }, [])

  const stop = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  const reset = useCallback(() => {
    bufferRef.current = ''
    setText('')
    setError(null)
  }, [])

  // Abandon du flux au démontage du composant (changement de page/conversation).
  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
      stopFlusher()
    }
  }, [stopFlusher])

  const start = useCallback(
    async (conversationId: string, question: string, lang: string): Promise<StreamOutcome> => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      bufferRef.current = ''
      setText('')
      setError(null)
      setStreaming(true)

      // Flush périodique du tampon vers l'état React (un rendu par frame, pas par token).
      flushTimerRef.current = setInterval(() => {
        setText(bufferRef.current)
      }, FLUSH_INTERVAL_MS)

      let doneMessageId: string | null = null
      let streamError: ApiError | null = null

      await streamChat(
        conversationId,
        { question, lang },
        {
          onDelta: (chunk) => {
            bufferRef.current += chunk
          },
          onDone: (messageId) => {
            doneMessageId = messageId
          },
          onError: (err) => {
            streamError = err
          },
        },
        controller.signal
      )

      stopFlusher()
      setText(bufferRef.current)
      setStreaming(false)
      if (streamError) setError(streamError)
      if (controllerRef.current === controller) controllerRef.current = null

      return { messageId: doneMessageId, text: bufferRef.current, error: streamError }
    },
    [stopFlusher]
  )

  return { streaming, text, error, start, stop, reset }
}
