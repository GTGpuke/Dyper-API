// Menu déroulant stylisé : remplace le <select> natif par un popover soigné, accessible au
// clavier (flèches, Entrée, Échap) et fermé au clic extérieur.
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

interface Option<T extends string> {
  value: T
  label: string
}

export function Dropdown<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  ariaLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  )
  const selected = options[selectedIndex]

  // Fermeture au clic en dehors du composant.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function openMenu(): void {
    setActiveIndex(selectedIndex)
    setOpen(true)
  }

  function choose(index: number): void {
    const option = options[index]
    if (option) onChange(option.value)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openMenu()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choose(activeIndex)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className={cn('relative inline-block', className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-sm text-ink-700 outline-none transition-colors hover:bg-ink-50 focus:border-brand-400 focus:shadow-focus dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700"
      >
        <span className="truncate">{selected?.label}</span>
        <svg
          className={cn('h-4 w-4 shrink-0 text-ink-400 transition-transform', open && 'rotate-180')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 z-30 mt-1.5 max-h-72 min-w-full overflow-auto rounded-xl border border-ink-200 bg-white py-1 shadow-card-hover dark:border-ink-700 dark:bg-ink-800"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => choose(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm transition-colors',
                      index === activeIndex
                        ? 'bg-ink-100 dark:bg-ink-700/70'
                        : 'text-ink-700 dark:text-ink-200',
                      isSelected && 'font-medium text-brand-700 dark:text-brand-300'
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && (
                      <svg className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
