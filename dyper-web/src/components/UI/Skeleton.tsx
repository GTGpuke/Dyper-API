// Bloc de chargement « shimmer » pour les états de fetch.
import { cn } from '../../lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-ink-100 dark:bg-ink-800', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  )
}
