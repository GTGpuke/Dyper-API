// Liste des objets détectés avec barre de confiance, triés par score décroissant.
import { ConfidenceBar } from '../ui/ConfidenceBar'
import type { DetectedObject } from '../../types'

export function ObjectList({
  objects,
  highlightIndex,
  onHover,
}: {
  objects: DetectedObject[]
  highlightIndex?: number | null
  onHover?: (index: number | null) => void
}) {
  const sorted = [...objects].sort((a, b) => b.confidence - a.confidence)

  return (
    <ul className="flex flex-col divide-y divide-ink-100 dark:divide-ink-800">
      {sorted.map((obj, i) => (
        <li
          key={`${obj.label}-${i}`}
          onMouseEnter={() => onHover?.(i)}
          onMouseLeave={() => onHover?.(null)}
          className={
            'flex items-center gap-4 py-2.5 transition-colors ' +
            (highlightIndex === i ? 'bg-brand-50/60 dark:bg-brand-600/10' : '')
          }
        >
          <span className="w-32 shrink-0 truncate text-sm font-medium capitalize text-ink-700 dark:text-ink-200">
            {obj.label}
          </span>
          <ConfidenceBar value={obj.confidence} className="flex-1" />
        </li>
      ))}
    </ul>
  )
}
