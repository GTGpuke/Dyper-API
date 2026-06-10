// Sélecteur segmenté (groupe de boutons exclusifs).
import { cn } from '../../lib/cn'

interface Option<T extends string> {
  value: T
  label: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            value === opt.value
              ? 'bg-white text-ink-800 shadow-sm dark:bg-ink-600 dark:text-ink-50'
              : 'text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
