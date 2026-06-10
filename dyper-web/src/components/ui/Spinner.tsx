// Indicateur de chargement circulaire minimaliste.
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'

export function Spinner({ className }: { className?: string }) {
  const { t } = useI18n()
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-ink-200 border-t-brand-600',
        className ?? 'h-4 w-4'
      )}
      role="status"
      aria-label={t('common.loading')}
    />
  )
}
