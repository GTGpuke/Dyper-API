// Vue détaillée d'une publication, rendue depuis le snapshot `payload` (média servi par URL
// publique). Partagée par le détail in-app et la page publique /p/:slug.
import { type ReactNode, useRef } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { publicMediaUrl, publicVideoUrl } from '../../services/api'
import type { Publication } from '../../types'
import { ColorPalette } from '../result/ColorPalette'
import { MusicBadge } from '../result/MusicBadge'
import { SceneBadge } from '../result/SceneBadge'
import { TagCloud } from '../result/TagCloud'
import { VideoPlayer } from '../result/VideoPlayer'
import { VideoTimeline } from '../result/VideoTimeline'

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
  const seekRef = useRef<((time: number) => void) | null>(null)
  const hasPlayer = publication.hasVideo

  return (
    <div className="flex flex-col gap-6">
      {hasPlayer ? (
        <VideoPlayer
          src={publicVideoUrl(publication.slug)}
          frames={p.frameDetections ?? []}
          sourceWidth={p.sourceWidth}
          sourceHeight={p.sourceHeight}
          seekRef={seekRef}
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

      {p.music && p.music.length > 0 && (
        <Section title={t('music.title')}>
          <div>
            <MusicBadge music={p.music} />
          </div>
        </Section>
      )}

      {p.timeline && p.timeline.length > 0 && (
        <Section title={t('timeline.title')}>
          <VideoTimeline
            timeline={p.timeline}
            onSeek={hasPlayer ? (time) => seekRef.current?.(time) : undefined}
          />
        </Section>
      )}

      {p.audioTranscript && (
        <Section title={t('transcript.title')}>
          <blockquote className="rounded-xl border-l-2 border-brand-400 bg-ink-50 px-3.5 py-2.5 text-sm italic leading-relaxed text-ink-600 dark:bg-ink-800/60 dark:text-ink-300">
            {p.audioTranscript}
          </blockquote>
        </Section>
      )}

      <Section title={t('result.scene')}>
        <SceneBadge label={p.sceneLabel} confidence={p.sceneConfidence} indoor={p.indoor} />
      </Section>

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
