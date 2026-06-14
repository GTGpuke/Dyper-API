// Barre d'action flottante de la sélection multiple : compteur et suppression groupée, avec
// confirmation en deux temps (motif cohérent avec le reste de l'application).
import { useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { Button } from '../ui/Button'

export function SelectionBar({
  count,
  deleting,
  onClear,
  onDelete,
}: {
  count: number
  deleting: boolean
  onClear: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-ink-200 bg-white px-4 py-2.5 shadow-card-hover dark:border-ink-700 dark:bg-ink-800">
      <span className="text-sm font-medium text-ink-700 dark:text-ink-200">
        {t('history.select.count', { n: count })}
      </span>
      {confirming ? (
        <>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" loading={deleting} onClick={onDelete} className="bg-red-600 hover:bg-red-700">
            {t('history.delete.confirm')}
          </Button>
        </>
      ) : (
        <>
          <Button variant="secondary" size="sm" onClick={onClear}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={() => setConfirming(true)} className="bg-red-600 hover:bg-red-700">
            {t('history.delete')}
          </Button>
        </>
      )}
    </div>
  )
}
