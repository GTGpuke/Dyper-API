// Identité publique d'un auteur : avatar (ou initiale) + pseudo + date relative.
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import { formatRelative } from '../../utils/formatters'

export function AuthorBadge({
  name,
  avatar,
  createdAt,
  className,
}: {
  name: string
  avatar: string | null
  createdAt: string
  className?: string
}) {
  const { lang } = useI18n()
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {avatar ? (
        <img src={avatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500/20 to-violet-600/20 text-xs font-semibold text-violet-700 dark:text-violet-300">
          {(name || '?').charAt(0).toUpperCase()}
        </span>
      )}
      <span className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{name}</span>
      <span className="shrink-0 text-xs text-ink-400 dark:text-ink-500">
        · {formatRelative(createdAt, lang)}
      </span>
    </div>
  )
}
