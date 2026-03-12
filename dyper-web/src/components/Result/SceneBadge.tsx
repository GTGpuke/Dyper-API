// Composant d'affichage du badge de scène avec icône intérieur/extérieur et score de confiance.
import { formatConfidence } from '../../utils/formatters'
import type { Scene } from '../../types'

interface SceneBadgeProps {
  scene: Scene
}

// Retourne l'icône correspondant au type de scène.
function getSceneIcon(indoor?: boolean): string {
  if (indoor === true) return '🏠'
  if (indoor === false) return '🌳'
  return '?'
}

export function SceneBadge({ scene }: SceneBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-full px-3 py-1.5">
      <span className="text-base" aria-hidden="true">{getSceneIcon(scene.indoor)}</span>
      <span className="text-sm font-medium text-gray-200 capitalize">{scene.label}</span>
      <span className="text-xs text-gray-400">{formatConfidence(scene.confidence)}</span>
    </div>
  )
}
