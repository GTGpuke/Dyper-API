// Carte d'analyse dans le fil : média annoté (lecteur vidéo ou image), ruban de stats, description,
// musique identifiée, détails repliables animés, chronologie cliquable, publication au Global.
import { AnimatePresence, motion } from 'framer-motion'
import { type ReactNode, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../contexts/I18nContext'
import { mediaUrl, videoUrl } from '../../services/api'
import type { InlineAnalysis } from '../../types'
import { PublishDialog } from '../global/PublishDialog'
import { BoundingBoxOverlay } from '../result/BoundingBoxOverlay'
import { ColorPalette } from '../result/ColorPalette'
import { MusicBadge } from '../result/MusicBadge'
import { ObjectList } from '../result/ObjectList'
import { SceneBadge } from '../result/SceneBadge'
import { TagCloud } from '../result/TagCloud'
import { VideoPlayer } from '../result/VideoPlayer'
import { VideoTimeline } from '../result/VideoTimeline'
import { StatChip } from '../ui/StatChip'

// Icônes (chemins SVG) du ruban de stats.
const ICON_OBJECTS: ReactNode = (
  <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
)
const ICON_RESOLUTION: ReactNode = (
  <>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
  </>
)
const ICON_MODEL: ReactNode = (
  <>
    <rect x="7" y="7" width="10" height="10" rx="1" />
    <path d="M9 4v3M15 4v3M9 17v3M15 17v3M4 9h3M4 15h3M17 9h3M17 15h3" />
  </>
)

export function AnalysisCardMessage({ analysis }: { analysis: InlineAnalysis }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [thumbFailed, setThumbFailed] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const seekRef = useRef<((time: number) => void) | null>(null)
  const publishable = analysis.type !== 'prompt'

  const thumbnail = analysis.thumbnailUrl ? mediaUrl(analysis.requestId) : null
  const showBoxes =
    analysis.type === 'image' && analysis.sourceWidth !== null && analysis.sourceHeight !== null
  // Lecteur annoté : vidéo conservée sur disque (les anciennes analyses gardent la miniature).
  const hasPlayer = Boolean(analysis.videoUrl)
  const hasResolution = analysis.sourceWidth !== null && analysis.sourceHeight !== null

  return (
    <div className="surface flex max-w-2xl flex-col gap-4 p-4">
      {/* Média : lecteur vidéo annoté, image annotée, ou miniature simple. */}
      {hasPlayer ? (
        <VideoPlayer
          src={videoUrl(analysis.requestId)}
          frames={analysis.frames ?? []}
          sourceWidth={analysis.sourceWidth}
          sourceHeight={analysis.sourceHeight}
          seekRef={seekRef}
        />
      ) : (
        thumbnail &&
        !thumbFailed &&
        (showBoxes ? (
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
        ))
      )}

      {/* Ruban de stats : un coup d'œil sur ce que le moteur a produit. */}
      <div className="flex flex-wrap gap-2">
        <StatChip icon={ICON_OBJECTS} label={t('card.stat.objects')} value={analysis.objects.length} />
        {hasResolution && (
          <StatChip
            icon={ICON_RESOLUTION}
            label={t('card.stat.resolution')}
            value={`${analysis.sourceWidth}×${analysis.sourceHeight}`}
          />
        )}
        <StatChip icon={ICON_MODEL} label={t('card.stat.model')} value={analysis.model} />
      </div>

      <p className="text-[15px] leading-relaxed text-ink-700 dark:text-ink-200">
        {analysis.description}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <SceneBadge
          label={analysis.sceneLabel}
          confidence={analysis.sceneConfidence}
          indoor={analysis.indoor}
        />
        {analysis.music && analysis.music.length > 0 && <MusicBadge music={analysis.music} />}
      </div>

      {/* Chronologie vidéo — cliquable quand le lecteur est présent (saute au segment). */}
      {analysis.timeline && analysis.timeline.length > 0 && (
        <div>
          <h4 className="eyebrow mb-2">{t('timeline.title')}</h4>
          <VideoTimeline
            timeline={analysis.timeline}
            onSeek={hasPlayer ? (time) => seekRef.current?.(time) : undefined}
          />
        </div>
      )}

      {/* Transcription audio complète (vidéos). */}
      {analysis.audioTranscript && (
        <div>
          <h4 className="eyebrow mb-2">{t('transcript.title')}</h4>
          <blockquote className="rounded-xl border-l-2 border-brand-400 bg-ink-50 px-3.5 py-2.5 text-sm italic leading-relaxed text-ink-600 dark:bg-ink-800/60 dark:text-ink-300">
            {analysis.audioTranscript}
          </blockquote>
        </div>
      )}

      {/* Détails repliés par défaut (dépli animé) pour garder le fil compact. */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
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
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3 dark:border-ink-800">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          {expanded ? t('chat.details.hide') : t('chat.details.show')}
        </button>
        <div className="flex items-center gap-3">
          {publishable && (
            <button
              type="button"
              onClick={() => setPublishing(true)}
              className="text-xs font-medium text-violet-600 hover:underline dark:text-violet-300"
            >
              {t('publish.action')}
            </button>
          )}
          <Link
            to={`/analysis/${analysis.id}`}
            className="text-xs text-ink-400 hover:text-ink-700 hover:underline dark:text-ink-500 dark:hover:text-ink-200"
          >
            {t('chat.openAnalysis')}
          </Link>
        </div>
      </div>

      {publishable && (
        <PublishDialog
          analysisId={analysis.id}
          open={publishing}
          onClose={() => setPublishing(false)}
        />
      )}
    </div>
  )
}
