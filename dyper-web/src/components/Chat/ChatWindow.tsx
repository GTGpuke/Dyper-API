// Composant racine du chat orchestrant les hooks de messages, d'analyse et d'envoi.
import { useChat } from '../../hooks/useChat'
import { useAnalyze } from '../../hooks/useAnalyze'
import { MessageList } from './MessageList'
import { InputBar } from './InputBar/InputBar'
import type { AnalysisResult, ApiError } from '../../types'

export function ChatWindow() {
  const { messages, addUserMessage, addBotMessage, addErrorMessage } = useChat()
  const { status, analyze } = useAnalyze()

  // Gère l'envoi d'un message texte ou image vers l'API et met à jour l'historique.
  function handleSend(text: string, file?: File): void {
    if (file) {
      addUserMessage({
        type: 'image',
        text: text || undefined,
        file,
        previewUrl: URL.createObjectURL(file),
      })
    } else {
      addUserMessage({ type: 'text', text })
    }

    function onSuccess(result: AnalysisResult): void {
      addBotMessage(result)
    }

    function onError(error: ApiError): void {
      addErrorMessage(error)
    }

    void analyze(onSuccess, onError, text || undefined, file)
  }

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} loading={status === 'loading'} />
      <InputBar
        onSend={handleSend}
        isDragging={false}
        disabled={status === 'loading'}
      />
    </div>
  )
}
