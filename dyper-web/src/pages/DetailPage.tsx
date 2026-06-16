// Page Détail : enregistrement complet d'une analyse (lecteur vidéo annoté inclus) +
// historique de chat persisté.
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PublishDialog } from '../components/global/PublishDialog'
import { PageContainer } from '../components/layout/PageContainer'
import { PageHeader } from '../components/layout/PageHeader'
import { BoundingBoxOverlay } from '../components/result/BoundingBoxOverlay'
import { MusicList } from '../components/result/MusicList'
import { ObjectList } from '../components/result/ObjectList'
import { TranscriptKaraoke } from '../components/result/TranscriptKaraoke'
import { SceneBadge } from '../components/result/SceneBadge'
import { ColorPalette } from '../components/result/ColorPalette'
import { TagCloud } from '../components/result/TagCloud'
import { VideoPlayer } from '../components/result/VideoPlayer'
import { mediaUrl, videoUrl } from '../services/api'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { useAnalysis } from '../hooks/useAnalysis'
import { useAnnotatedVideo } from '../hooks/useAnnotatedVideo'
import { useI18n } from '../contexts/I18nContext'
import { formatDateTime, formatProcessingTime, modelLabel } from '../utils/formatters'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="eyebrow">{title}</h3>
      {children}
    </div>
  )
}

export function DetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, lang } = useI18n()
  const { analysis, chat, loading, error } = useAnalysis(id)
  const priorityLabels = useMemo(
    () => new Set((analysis?.objects ?? []).filter((o) => o.priority !== false).map((o) => o.label)),
    [analysis?.objects]
  )
  const av = useAnnotatedVideo(priorityLabels)
  const [publishing, setPublishing] = useState(false)
  const hasPlayer = Boolean(analysis?.video_path)
  // Image annotée : mêmes boîtes interactives + filtre que dans le fil (parité avec la vidéo).
  const showImageBoxes =
    analysis?.type === 'image' &&
    analysis.source_width !== null &&
    analysis.source_height !== null &&
    Boolean(analysis.thumbnail_path)

  return (
    <PageContainer>
      <Link to="/history" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200">
        ← {t('detail.back')}
      </Link>

      {error && <ErrorBanner error={error} />}

      {loading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40" />
        </div>
      )}

      {!loading && analysis && (
        <>
          <PageHeader
            title={t('detail.title')}
            subtitle={formatDateTime(analysis.created_at, lang)}
            actions={
              <div className="flex items-center gap-2">
                {analysis.type !== 'prompt' && (
                  <Button size="sm" onClick={() => setPublishing(true)}>
                    {t('publish.action')}
                  </Button>
                )}
                <Badge tone="brand">{t(`type.${analysis.type}`)}</Badge>
              </div>
            }
          />

          {analysis.type !== 'prompt' && (
            <PublishDialog
              analysisId={analysis.id}
              open={publishing}
              onClose={() => setPublishing(false)}
            />
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Colonne principale. */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              <div className="surface flex flex-col gap-6 p-6">
                {/* Média : lecteur vidéo annoté si la vidéo est conservée, sinon miniature. */}
                {hasPlayer ? (
                  <VideoPlayer
                    src={videoUrl(analysis.request_id)}
                    frames={analysis.frame_detections ?? []}
                    sourceWidth={analysis.source_width}
                    sourceHeight={analysis.source_height}
                    {...av.player}
                  />
                ) : showImageBoxes ? (
                  <BoundingBoxOverlay
                    src={mediaUrl(analysis.request_id)}
                    objects={analysis.objects ?? []}
                    sourceDims={{
                      w: analysis.source_width as number,
                      h: analysis.source_height as number,
                    }}
                  />
                ) : (
                  analysis.thumbnail_path && (
                    <img
                      src={mediaUrl(analysis.request_id)}
                      alt={t('history.thumbnailAlt')}
                      className="max-h-80 w-full rounded-xl border border-ink-200 object-contain dark:border-ink-800"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )
                )}

                <Section title={t('result.description')}>
                  <p className="text-[15px] leading-relaxed text-ink-700 dark:text-ink-200">{analysis.description}</p>
                </Section>

                <Section title={t('result.scene')}>
                  <SceneBadge
                    label={analysis.scene_label}
                    confidence={analysis.scene_confidence}
                    indoor={analysis.indoor}
                  />
                </Section>

                {analysis.objects && analysis.objects.length > 0 && (
                  <Section title={`${t('result.objects')} (${analysis.objects.length})`}>
                    <ObjectList
                      objects={analysis.objects}
                      timeline={analysis.timeline}
                      onSeek={hasPlayer ? av.seek : undefined}
                      {...av.timeline}
                    />
                  </Section>
                )}

                {analysis.audio_transcript && (
                  <Section title={t('transcript.title')}>
                    <TranscriptKaraoke
                      text={analysis.audio_transcript}
                      segments={analysis.transcript_segments}
                      timeRef={hasPlayer ? av.timeline.timeRef : undefined}
                      playing={av.timeline.playing}
                    />
                  </Section>
                )}

                {analysis.music && analysis.music.length > 0 && (
                  <Section title={t('music.title')}>
                    <MusicList music={analysis.music} />
                  </Section>
                )}

                {analysis.colors.length > 0 && (
                  <Section title={t('result.colors')}>
                    <ColorPalette colors={analysis.colors} />
                  </Section>
                )}

                {analysis.tags.length > 0 && (
                  <Section title={t('result.tags')}>
                    <TagCloud tags={analysis.tags} />
                  </Section>
                )}
              </div>

              {/* Historique de chat persisté (table chat_exchange). */}
              <div className="surface flex flex-col gap-4 p-6">
                <h3 className="eyebrow">{t('detail.chat', { n: chat.length })}</h3>
                {chat.length === 0 ? (
                  <p className="text-sm text-ink-400 dark:text-ink-500">{t('detail.chatEmpty')}</p>
                ) : (
                  <div className="flex flex-col gap-5">
                    {chat.map((ex) => (
                      <div key={ex.id} className="flex flex-col gap-2">
                        <div className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl bg-brand-600 px-3.5 py-2 text-sm text-white">
                            {ex.question}
                          </div>
                        </div>
                        <div className="flex justify-start">
                          <div className="max-w-[85%] rounded-2xl bg-ink-100 px-3.5 py-2 text-sm leading-relaxed text-ink-700 dark:bg-ink-700 dark:text-ink-100">
                            {ex.answer}
                          </div>
                        </div>
                        <span className="text-right text-[11px] text-ink-400 dark:text-ink-500">
                          {formatDateTime(ex.created_at, lang)} · {ex.model}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Colonne latérale : métadonnées. */}
            <aside className="flex flex-col gap-3">
              <div className="surface flex flex-col gap-4 p-5">
                <h3 className="eyebrow">{t('detail.meta')}</h3>
                <Meta label={t('detail.meta.objects')} value={String(analysis.objects_count)} />
                <Meta label={t('detail.meta.model')} value={modelLabel(analysis.type)} />
                <Meta label={t('detail.meta.duration')} value={formatProcessingTime(analysis.processing_time_ms)} />
                <Meta label={t('detail.meta.lang')} value={analysis.lang.toUpperCase()} />
                <Meta label={t('detail.meta.requestId')} value={analysis.request_id} mono small />
              </div>
            </aside>
          </div>
        </>
      )}
    </PageContainer>
  )
}

function Meta({
  label,
  value,
  mono,
  small,
}: {
  label: string
  value: string
  mono?: boolean
  small?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-ink-100 pb-2 last:border-0 last:pb-0 dark:border-ink-800">
      <span className="text-xs text-ink-400 dark:text-ink-500">{label}</span>
      <span
        className={
          (mono ? 'font-mono ' : '') +
          (small ? 'text-xs ' : 'text-sm ') +
          'break-all text-ink-700 dark:text-ink-200'
        }
      >
        {value}
      </span>
    </div>
  )
}
