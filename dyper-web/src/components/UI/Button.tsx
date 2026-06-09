// Bouton réutilisable avec variantes éditoriales.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-300',
  secondary:
    'bg-white text-ink-700 border border-ink-200 hover:bg-ink-50 disabled:text-ink-300 dark:bg-ink-800 dark:text-ink-200 dark:border-ink-700 dark:hover:bg-ink-700',
  ghost:
    'text-ink-600 hover:bg-ink-100 disabled:text-ink-300 dark:text-ink-300 dark:hover:bg-ink-800',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold transition-colors',
        'focus:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4 border-white/40 border-t-white" />}
      {children}
    </button>
  )
}
