// Message assistant : pastille d'avatar + carte d'analyse ou texte selon la nature du message.
import type { ClientMessage } from '../../types'
import { AnalysisCardMessage } from './AnalysisCardMessage'
import { AssistantText } from './AssistantText'

export function AssistantMessage({ message }: { message: ClientMessage }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" strokeLinecap="round" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        {message.kind === 'analysis' && message.analysis ? (
          <AnalysisCardMessage analysis={message.analysis} />
        ) : (
          <AssistantText content={message.content} interrupted={message.status === 'interrupted'} />
        )}
      </div>
    </div>
  )
}
