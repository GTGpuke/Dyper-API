// Chat de suivi sur un résultat d'analyse (questions au LLM Groq, persistées en base).
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { useChat } from '../../hooks/useChat'
import { useI18n } from '../../contexts/I18nContext'
import { Spinner } from '../ui/Spinner'
import type { AnalysisResult } from '../../types'

export function FollowUpChat({ context }: { context: AnalysisResult }) {
  const { t } = useI18n()
  const { messages, sending, ask } = useChat()
  const [draft, setDraft] = useState('')

  function send(): void {
    const q = draft.trim()
    if (!q || sending) return
    setDraft('')
    void ask(q, context)
  }

  return (
    <div className="surface flex flex-col p-5">
      <h3 className="eyebrow mb-3">{t('chat.title')}</h3>

      <div className="flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-sm text-ink-400 dark:text-ink-500">{t('chat.empty')}</p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                  m.role === 'user' && 'bg-brand-600 text-white',
                  m.role === 'bot' && 'bg-ink-100 text-ink-700 dark:bg-ink-700 dark:text-ink-100',
                  m.role === 'error' && 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                )}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {sending && (
          <div className="flex items-center gap-2 text-sm text-ink-400 dark:text-ink-500">
            <Spinner /> {t('chat.thinking')}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={t('chat.placeholder')}
          className="flex-1 rounded-xl border border-ink-200 px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:shadow-focus dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50 dark:placeholder:text-ink-500"
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim() || sending}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-brand-300"
          aria-label="Envoyer"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 10l16-8-8 16-2-6-6-2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
