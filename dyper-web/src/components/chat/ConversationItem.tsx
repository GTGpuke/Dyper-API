// Ligne de conversation dans la sidebar : navigation, renommage inline, suppression en 2 temps.
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useConversations } from '../../contexts/ConversationsContext'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { Conversation } from '../../types'

export function ConversationItem({ conversation }: { conversation: Conversation }) {
  const { t } = useI18n()
  const { rename, remove } = useConversations()
  const navigate = useNavigate()
  // La sidebar est rendue par la route layout : useParams n'y voit pas les params des routes
  // enfants — l'état actif est donc dérivé du pathname.
  const { pathname } = useLocation()
  const isActive = pathname === `/c/${conversation.id}`

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conversation.title)
  const [confirming, setConfirming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // La confirmation de suppression expire après 3 secondes.
  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), 3000)
    return () => clearTimeout(timer)
  }, [confirming])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  async function commitRename(): Promise<void> {
    setEditing(false)
    const title = draft.trim()
    if (!title || title === conversation.title) {
      setDraft(conversation.title)
      return
    }
    try {
      await rename(conversation.id, title)
    } catch {
      setDraft(conversation.title)
    }
  }

  async function confirmDelete(): Promise<void> {
    await remove(conversation.id)
    if (isActive) navigate('/')
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commitRename()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commitRename()
          if (e.key === 'Escape') {
            setDraft(conversation.title)
            setEditing(false)
          }
        }}
        maxLength={120}
        className="w-full rounded-lg border border-brand-400 bg-white px-2.5 py-1.5 text-sm outline-none dark:bg-ink-800 dark:text-ink-50"
        aria-label={t('chat.rename')}
      />
    )
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-lg pr-1 transition-colors',
        isActive ? 'bg-brand-50 dark:bg-brand-600/15' : 'hover:bg-ink-100 dark:hover:bg-ink-800'
      )}
    >
      <NavLink
        to={`/c/${conversation.id}`}
        className={cn(
          'min-w-0 flex-1 truncate px-2.5 py-1.5 text-sm',
          isActive
            ? 'font-medium text-brand-700 dark:text-brand-300'
            : 'text-ink-600 dark:text-ink-300'
        )}
        title={conversation.title}
      >
        {conversation.title || t('chat.untitled')}
      </NavLink>

      {/* Actions révélées au survol / focus. */}
      <div className="hidden shrink-0 items-center group-focus-within:flex group-hover:flex">
        {confirming ? (
          <>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              className="grid h-6 w-6 place-items-center rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              aria-label={t('chat.deleteConfirm')}
              title={t('chat.deleteConfirm')}
            >
              ✓
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700"
              aria-label={t('chat.deleteCancel')}
              title={t('chat.deleteCancel')}
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-200"
              aria-label={t('chat.rename')}
              title={t('chat.rename')}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
              aria-label={t('chat.delete')}
              title={t('chat.delete')}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
