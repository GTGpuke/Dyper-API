// Contexte de la liste des conversations : partagé entre la Sidebar (navigation, renommage,
// suppression) et la page de chat (création, remontée en tête après un envoi).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import * as api from '../services/api'
import type { Conversation } from '../types'

interface ConversationsContextValue {
  conversations: Conversation[]
  loading: boolean
  create: () => Promise<Conversation>
  rename: (id: string, title: string) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Remonte une conversation en tête de liste (envoi de message), avec titre éventuel. */
  touch: (id: string, title?: string) => void
  refresh: () => Promise<void>
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null)

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setConversations(await api.listConversations())
    } catch {
      // Liste indisponible : la sidebar affiche simplement une liste vide.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(async () => {
    const conversation = await api.createConversation()
    setConversations((prev) => [conversation, ...prev])
    return conversation
  }, [])

  const rename = useCallback(async (id: string, title: string) => {
    const updated = await api.renameConversation(id, title)
    setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)))
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.deleteConversation(id)
    setConversations((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const touch = useCallback((id: string, title?: string) => {
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === id)
      if (!existing) return prev
      const updated: Conversation = {
        ...existing,
        title: title ?? existing.title,
        updatedAt: new Date().toISOString(),
      }
      return [updated, ...prev.filter((c) => c.id !== id)]
    })
  }, [])

  return (
    <ConversationsContext.Provider
      value={{ conversations, loading, create, rename, remove, touch, refresh }}
    >
      {children}
    </ConversationsContext.Provider>
  )
}

export function useConversations(): ConversationsContextValue {
  const ctx = useContext(ConversationsContext)
  if (!ctx) throw new Error('useConversations doit être utilisé dans un ConversationsProvider.')
  return ctx
}
