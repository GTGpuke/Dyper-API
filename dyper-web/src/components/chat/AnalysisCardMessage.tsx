// Carte d'analyse dans le fil : miniature annotée, description, détails repliables, timeline.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../contexts/I18nContext'
import { mediaUrl } from '../../services/api'
import type { InlineAnalysis } from '../../types'
import { BoundingBoxOverlay } from '../result/BoundingBoxOverlay'
import { ColorPalette } from '../result/ColorPalette'
import { ObjectList } from '../result/ObjectList'
import { SceneBadge } from '../result/SceneBadge'
import { TagCloud } from '../result/TagCloud'
import { VideoTimeline } from '../result/VideoTimeline'

export function AnalysisCardMessage({ analysis }: { analysis: InlineAnalysis }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [thumbFailed, setThumbFailed] = useState(false)

  const thumbnail = analysis.thumbnailUrl ? mediaUrl(analysis.requestId) : null
  const showBoxes =
    analysis.type === 'image' && analysis.sourceWidth !== null && analysis.sourceHeight !== null

  return (
    <div className="surface flex max-w-2xl flex-col gap-4 p-4">
      {/* Miniature (annotée pour les images, simple pour les vidéos). */}
      {thumbnail && !thumbFailed && (
        showBoxes ? (
          <BoundingBoxOverlay
            src={thumbnail}
            objects={analysis.objects}
            highlightIndex={hover}
            onHover={setHover}
            sourceDims={{ w: analysis.sourceWidth as number, h: analysis.sourceHeight as number }}
          />
        ) : (
          <img
            src={thumbnail}
            alt={t('history.thumbnailAlt')}
            loading="lazy"
            onError={() => setThumbFailed(true)}
            className="max-h-72 w-full rounded-xl border border-ink-200 object-contain dark:border-ink-800"
          />
        )
      )}

      <p className="text-[15px] leading-relaxed text-ink-700 dark:text-ink-200">
        {analysis.description}
      </p>

      <SceneBadge
        label={analysis.sceneLabel}
        confidence={analysis.sceneConfidence}
        indoor={analysis.indoor}
      />

      {/* Chronologie vidéo. */}
      {analysis.timeline && analysis.timeline.length > 0 && (
        <div>
          <h4 className="eyebrow mb-2">{t('timeline.title')}</h4>
          <VideoTimeline timeline={analysis.timeline} />
        </div>
      )}

      {/* Détails repliés par défaut pour garder le fil compact. */}
      {expanded && (
        <div className="flex flex-col gap-4 border-t border-ink-100 pt-4 dark:border-ink-800">
          {analysis.objects.length > 0 && (
            <div>
              <h4 className="eyebrow mb-2">
                {t('result.objects')} ({analysis.objects.length})
              </h4>
              <ObjectList objects={analysis.objects} highlightIndex={hover} onHover={setHover} />
            </div>
          )}
          {analysis.colors.length > 0 && (
            <div>
              <h4 className="eyebrow mb-2">{t('result.colors')}</h4>
              <ColorPalette colors={analysis.colors} />
            </div>
          )}
          {analysis.tags.length > 0 && (
            <div>
              <h4 className="eyebrow mb-2">{t('result.tags')}</h4>
              <TagCloud tags={analysis.tags} />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-ink-100 pt-3 dark:border-ink-800">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          {expanded ? t('chat.details.hide') : t('chat.details.show')}
        </button>
        <Link
          to={`/analysis/${analysis.id}`}
          className="text-xs text-ink-400 hover:text-ink-700 hover:underline dark:text-ink-500 dark:hover:text-ink-200"
        >
          {t('chat.openAnalysis')}
        </Link>
      </div>
    </div>
  )
}
