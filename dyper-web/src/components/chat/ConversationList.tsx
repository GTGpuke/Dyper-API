// Liste des conversations groupée par récence (Aujourd'hui / Hier / 7 jours / Plus ancien).
import { useMemo } from 'react'
import { useConversations } from '../../contexts/ConversationsContext'
import { useI18n } from '../../contexts/I18nContext'
import type { Conversation } from '../../types'
import { recencyGroup, type RecencyGroup } from '../../utils/formatters'
import { ConversationItem } from './ConversationItem'

const GROUP_ORDER: RecencyGroup[] = ['today', 'yesterday', 'week', 'older']

const GROUP_KEYS: Record<RecencyGroup, string> = {
  today: 'chat.group.today',
  yesterday: 'chat.group.yesterday',
  week: 'chat.group.week',
  older: 'chat.group.older',
}

export function ConversationList() {
  const { t } = useI18n()
  const { conversations, loading } = useConversations()

  const groups = useMemo(() => {
    const map = new Map<RecencyGroup, Conversation[]>()
    for (const conversation of conversations) {
      const group = recencyGroup(conversation.updatedAt)
      map.set(group, [...(map.get(group) ?? []), conversation])
    }
    return map
  }, [conversations])

  if (loading) return null

  if (conversations.length === 0) {
    return <p className="px-2.5 py-2 text-xs text-ink-400 dark:text-ink-500">{t('chat.emptyList')}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {GROUP_ORDER.map((group) => {
        const items = groups.get(group)
        if (!items?.length) return null
        return (
          <div key={group} className="flex flex-col gap-0.5">
            <p className="eyebrow px-2.5 pb-1">{t(GROUP_KEYS[group])}</p>
            {items.map((conversation) => (
              <ConversationItem key={conversation.id} conversation={conversation} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
