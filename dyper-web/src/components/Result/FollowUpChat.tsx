// Composant de chat de suivi permettant de poser des questions sur un résultat d'analyse.
import { useState } from 'react'
import { chatWithResult } from '../../services/api'
import type { AnalysisResult } from '../../types'

interface FollowUpChatProps {
  result: AnalysisResult
}

export function FollowUpChat({ result }: FollowUpChatProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (!q || loading) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const response = await chatWithResult(q, result)
      setAnswer(response)
    } catch {
      setError("Impossible d'obtenir une réponse. Veuillez réessayer.")
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <div className="mt-3 border-t border-gray-700 pt-3 flex flex-col gap-2">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
        Poser une question sur ce résultat
      </p>

      {answer && (
        <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 whitespace-pre-wrap">
          {answer}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex: Quels objets sont au premier plan ?"
          rows={2}
          disabled={loading}
          className="flex-1 resize-none bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="flex items-center justify-center h-9 w-9 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white disabled:text-gray-500 transition-colors disabled:cursor-not-allowed flex-shrink-0"
          aria-label="Envoyer la question"
        >
          {loading ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  )
}
