// Pastille de type d'analyse (atome) : image / vidéo / prompt, avec teinte dédiée.
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { AnalyzeType } from '../../types'

const TONE: Record<AnalyzeType, string> = {
  image: 'bg-brand-500/15 text-brand-700 dark:text-brand-300',
  video: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  prompt: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
}

export function TypeBadge({
  type,
  size = 'md',
  className,
}: {
  type: AnalyzeType
  size?: 'sm' | 'md'
  className?: string
}) {
  const { t } = useI18n()
  return (
    <span
      className={cn(
        'shrink-0 rounded-md font-semibold',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
        TONE[type],
        className
      )}
    >
      {t(`type.${type}`)}
    </span>
  )
}
