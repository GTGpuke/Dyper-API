// Composant de carte de résultat complet regroupant toutes les informations d'une analyse.
import { ObjectList } from './ObjectList'
import { SceneBadge } from './SceneBadge'
import { TagCloud } from './TagCloud'
import { ColorPalette } from './ColorPalette'
import { formatProcessingTime } from '../../utils/formatters'
import type { AnalysisResult } from '../../types'

interface ResultCardProps {
  result: AnalysisResult
}

export function ResultCard({ result }: ResultCardProps) {
  const { description, visualization, model, processingTime } = result

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex flex-col gap-4 max-w-full">
      {/* Section description textuelle. */}
      <p className="text-sm text-gray-200 leading-relaxed">{description}</p>

      {/* Badge de scène. */}
      <SceneBadge scene={visualization.scene} />

      {/* Liste des objets détectés. */}
      {visualization.objects.length > 0 && (
        <ObjectList objects={visualization.objects} />
      )}

      {/* Palette de couleurs dominantes. */}
      {visualization.colors.length > 0 && (
        <ColorPalette colors={visualization.colors} />
      )}

      {/* Nuage de tags. */}
      {visualization.tags.length > 0 && (
        <TagCloud tags={visualization.tags} />
      )}

      {/* Pied de carte : modèle utilisé et temps de traitement. */}
      <div className="flex items-center justify-between border-t border-gray-800 pt-3 mt-1">
        <span className="text-xs text-gray-500 font-mono">{model}</span>
        <span className="text-xs text-gray-500">{formatProcessingTime(processingTime)}</span>
      </div>
    </div>
  )
}
