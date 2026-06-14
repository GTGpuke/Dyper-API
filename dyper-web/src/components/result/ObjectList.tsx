// Liste des objets détectés avec pastille de couleur (accordée aux boîtes), barre de confiance,
// triés par score décroissant.
import type { DetectedObject } from '../../types'
import { labelColor } from '../../utils/labelColor'
import { ConfidenceBar } from '../ui/ConfidenceBar'

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
            'flex items-center gap-3 py-2.5 transition-colors ' +
            (highlightIndex === i ? 'bg-brand-50/60 dark:bg-brand-600/10' : '')
          }
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: labelColor(obj.label) }}
          />
          <span className="w-28 shrink-0 truncate text-sm font-medium capitalize text-ink-700 dark:text-ink-200">
            {obj.label}
          </span>
          <ConfidenceBar value={obj.confidence} className="flex-1" />
        </li>
      ))}
    </ul>
  )
}
