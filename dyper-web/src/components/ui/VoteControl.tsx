// Contrôle de vote (haut / bas) façon Reddit : flèches + score, état actif selon le vote courant.
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { PublicVote } from '../../types'

export function VoteControl({
  score,
  myVote,
  onChange,
  disabled = false,
  orientation = 'horizontal',
}: {
  score: number
  myVote: PublicVote
  onChange: (value: PublicVote) => void
  disabled?: boolean
  orientation?: 'vertical' | 'horizontal'
}) {
  const { t } = useI18n()

  return (
    <div
      className={cn(
        'flex items-center gap-0.5',
        orientation === 'vertical' ? 'flex-col' : 'flex-row'
      )}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={t('vote.up')}
        aria-pressed={myVote === 1}
        onClick={() => onChange(myVote === 1 ? 0 : 1)}
        className={cn(
          'grid h-7 w-7 place-items-center rounded-md transition-colors',
          myVote === 1
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-ink-400 hover:bg-ink-100 hover:text-ink-600 dark:hover:bg-ink-800',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill={myVote === 1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5l7 8H5z" />
        </svg>
      </button>
      <span
        className={cn(
          'min-w-[1.75rem] text-center text-sm font-semibold tabular-nums',
          myVote === 1
            ? 'text-emerald-600 dark:text-emerald-400'
            : myVote === -1
              ? 'text-red-600 dark:text-red-400'
              : 'text-ink-600 dark:text-ink-300'
        )}
      >
        {score}
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-label={t('vote.down')}
        aria-pressed={myVote === -1}
        onClick={() => onChange(myVote === -1 ? 0 : -1)}
        className={cn(
          'grid h-7 w-7 place-items-center rounded-md transition-colors',
          myVote === -1
            ? 'text-red-600 dark:text-red-400'
            : 'text-ink-400 hover:bg-ink-100 hover:text-ink-600 dark:hover:bg-ink-800',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill={myVote === -1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l-7-8h14z" />
        </svg>
      </button>
    </div>
  )
}
