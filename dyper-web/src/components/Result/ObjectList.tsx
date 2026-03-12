// Composant d'affichage de la liste des objets détectés avec barres de progression de confiance.
import { formatConfidence } from '../../utils/formatters'
import type { DetectedObject } from '../../types'

interface ObjectListProps {
  objects: DetectedObject[]
}

export function ObjectList({ objects }: ObjectListProps) {
  // Trie les objets par score de confiance décroissant.
  const sorted = [...objects].sort((a, b) => b.confidence - a.confidence)

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Objets détectés
      </h3>
      {sorted.map((obj, i) => (
        <div key={`${obj.label}-${i}`} className="flex items-center gap-3">
          <span className="text-sm text-gray-200 w-28 shrink-0 capitalize">{obj.label}</span>
          <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round(obj.confidence * 100)}%`,
                backgroundColor: `hsl(${Math.round(obj.confidence * 120)}, 70%, 50%)`,
              }}
            />
          </div>
          <span className="text-xs text-gray-400 w-10 text-right shrink-0">
            {formatConfidence(obj.confidence)}
          </span>
        </div>
      ))}
    </div>
  )
}
