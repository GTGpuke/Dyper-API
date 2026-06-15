// Vue détaillée d'une publication, rendue depuis le snapshot `payload` (média servi par URL
// publique). Partagée par le détail in-app et la page publique /p/:slug.
import { type ReactNode, useMemo } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { useAnnotatedVideo } from '../../hooks/useAnnotatedVideo'
import { publicMediaUrl, publicVideoUrl } from '../../services/api'
import type { Publication } from '../../types'
import { BoundingBoxOverlay } from '../result/BoundingBoxOverlay'
import { ColorPalette } from '../result/ColorPalette'
import { MusicList } from '../result/MusicList'
import { ObjectList } from '../result/ObjectList'
import { TranscriptKaraoke } from '../result/TranscriptKaraoke'
import { SceneBadge } from '../result/SceneBadge'
import { TagCloud } from '../result/TagCloud'
import { VideoPlayer } from '../result/VideoPlayer'
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="eyebrow">{title}</h3>
      {children}
    </div>
  )
}

export function PublicationView({ publication }: { publication: Publication }) {
  const { t } = useI18n()
  const p = publication.payload
  const priorityLabels = useMemo(
    () => new Set((p.objects ?? []).filter((o) => o.priority !== false).map((o) => o.label)),
    [p.objects]
  )
  const av = useAnnotatedVideo(priorityLabels)
  const hasPlayer = publication.hasVideo
  // Image annotée : mêmes boîtes interactives + filtre que la carte (parité avec la vidéo).
  const showImageBoxes =
    publication.type === 'image' &&
    publication.hasThumbnail &&
    p.sourceWidth !== null &&
    p.sourceHeight !== null

  return (
    <div className="flex flex-col gap-6">
      {hasPlayer ? (
        <VideoPlayer
          src={publicVideoUrl(publication.slug)}
          frames={p.frameDetections ?? []}
          sourceWidth={p.sourceWidth}
          sourceHeight={p.sourceHeight}
          {...av.player}
        />
      ) : showImageBoxes ? (
        <BoundingBoxOverlay
          src={publicMediaUrl(publication.slug)}
          objects={p.objects ?? []}
          sourceDims={{ w: p.sourceWidth as number, h: p.sourceHeight as number }}
        />
      ) : (
        publication.hasThumbnail && (
          <img
            src={publicMediaUrl(publication.slug)}
            alt={t('history.thumbnailAlt')}
            className="max-h-[28rem] w-full rounded-xl border border-ink-200 object-contain dark:border-ink-800"
          />
        )
      )}

      {publication.caption && (
        <p className="text-lg font-medium leading-relaxed text-ink-900 dark:text-ink-50">
          {publication.caption}
        </p>
      )}

      <Section title={t('result.description')}>
        <p className="text-[15px] leading-relaxed text-ink-700 dark:text-ink-200">{p.description}</p>
      </Section>

      <Section title={t('result.scene')}>
        <SceneBadge label={p.sceneLabel} confidence={p.sceneConfidence} indoor={p.indoor} />
      </Section>

      {p.objects && p.objects.length > 0 && (
        <Section title={`${t('result.objects')} (${p.objects.length})`}>
          <ObjectList
            objects={p.objects}
            timeline={p.timeline}
            onSeek={hasPlayer ? av.seek : undefined}
            {...av.timeline}
          />
        </Section>
      )}

      {p.audioTranscript && (
        <Section title={t('transcript.title')}>
          <TranscriptKaraoke
            text={p.audioTranscript}
            segments={p.transcriptSegments}
            timeRef={hasPlayer ? av.timeline.timeRef : undefined}
            playing={av.timeline.playing}
          />
        </Section>
      )}

      {p.music && p.music.length > 0 && (
        <Section title={t('music.title')}>
          <MusicList music={p.music} />
        </Section>
      )}

      {p.colors.length > 0 && (
        <Section title={t('result.colors')}>
          <ColorPalette colors={p.colors} />
        </Section>
      )}

      {p.tags.length > 0 && (
        <Section title={t('result.tags')}>
          <TagCloud tags={p.tags} />
        </Section>
      )}
    </div>
  )
}
