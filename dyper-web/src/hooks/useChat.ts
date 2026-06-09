// Hook de chat de suivi « live » sur un résultat d'analyse en cours de session.
// Les échanges sont aussi persistés côté passerelle (table chat_exchange) via /api/chat.
import { useState } from 'react'
import { nanoid } from 'nanoid'
import * as api from '../services/api'
import type { AnalysisResult, ApiError, LiveChatMessage } from '../types'

interface UseChatReturn {
  messages: LiveChatMessage[]
  sending: boolean
  ask: (question: string, context: AnalysisResult) => Promise<void>
  reset: () => void
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<LiveChatMessage[]>([])
  const [sending, setSending] = useState(false)

  function push(role: LiveChatMessage['role'], content: string): void {
    setMessages((prev) => [...prev, { id: nanoid(), role, content, timestamp: new Date() }])
  }

  async function ask(question: string, context: AnalysisResult): Promise<void> {
    push('user', question)
    setSending(true)
    try {
      const answer = await api.chatWithResult(question, context, context.lang)
      push('bot', answer)
    } catch (err) {
      push('error', (err as ApiError).message)
    } finally {
      setSending(false)
    }
  }

  function reset(): void {
    setMessages([])
  }

  return { messages, sending, ask, reset }
}
