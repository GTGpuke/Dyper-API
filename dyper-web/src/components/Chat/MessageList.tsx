// Composant de liste scrollable des messages avec défilement automatique vers le bas.
import { useEffect, useRef } from 'react'
import { Message } from './Message'
import { TypingIndicator } from './TypingIndicator'
import type { ChatMessage } from '../../types'

interface MessageListProps {
  messages: ChatMessage[]
  loading: boolean
}

export function MessageList({ messages, loading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Fait défiler la liste vers le bas à chaque nouveau message ou changement d'état.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
      {messages.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 text-sm">Envoyez un message ou déposez une image pour commencer.</p>
        </div>
      )}
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}
      {loading && (
        <div className="flex items-start">
          <div className="bg-gray-800 rounded-2xl rounded-bl-sm">
            <TypingIndicator />
          </div>
        </div>
      )}
      {/* Ancre de défilement vers le bas. */}
      <div ref={bottomRef} />
    </div>
  )
}
