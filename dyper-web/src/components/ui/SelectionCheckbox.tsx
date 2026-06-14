// Case à cocher de sélection (atome) : superposée sur les cartes (variante « overlay ») ou
// alignée dans la vue liste (variante « plain »). Le parent gère sa visibilité via className.
import { cn } from '../../lib/cn'

const UNCHECKED: Record<'overlay' | 'plain', string> = {
  overlay: 'border-white/70 bg-black/30 text-transparent backdrop-blur',
  plain: 'border-ink-300 text-transparent dark:border-ink-600',
}

export function SelectionCheckbox({
  checked,
  onToggle,
  label,
  variant = 'plain',
  className,
}: {
  checked: boolean
  onToggle: () => void
  label: string
  variant?: 'overlay' | 'plain'
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-label={label}
      aria-pressed={checked}
      className={cn(
        'grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-all',
        checked ? 'border-brand-500 bg-brand-500 text-white' : UNCHECKED[variant],
        className
      )}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l5 5L20 7" />
      </svg>
    </button>
  )
}
