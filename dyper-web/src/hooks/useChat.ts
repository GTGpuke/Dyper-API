// Hook de gestion de l'historique des messages du chat.
import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { ChatMessage, UserTextContent, UserImageContent, AnalysisResult, ApiError } from '../types'

interface UseChatReturn {
  messages: ChatMessage[]
  addUserMessage: (content: UserTextContent | UserImageContent) => string
  addBotMessage: (result: AnalysisResult) => void
  addErrorMessage: (error: ApiError) => void
  clearChat: () => void
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  function addUserMessage(content: UserTextContent | UserImageContent): string {
    const id = nanoid()
    setMessages(prev => [...prev, { id, role: 'user', timestamp: new Date(), content }])
    return id
  }

  function addBotMessage(result: AnalysisResult): void {
    const id = nanoid()
    setMessages(prev => [...prev, {
      id, role: 'bot', timestamp: new Date(),
      content: { type: 'result', result }
    }])
  }

  function addErrorMessage(error: ApiError): void {
    const id = nanoid()
    setMessages(prev => [...prev, {
      id, role: 'error', timestamp: new Date(),
      content: { type: 'error', message: error.message, code: error.code }
    }])
  }

  function clearChat(): void {
    setMessages([])
  }

  return { messages, addUserMessage, addBotMessage, addErrorMessage, clearChat }
}
