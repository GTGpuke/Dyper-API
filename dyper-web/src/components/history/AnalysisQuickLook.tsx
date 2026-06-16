// Aperçu rapide d'une analyse en panneau latéral : rend l'enregistrement déjà chargé
// (zéro fetch) — média ou lecteur vidéo annoté, description, transcription,
// musique, scène, couleurs, tags, métadonnées — avec accès au détail complet et suppression.
import { AnimatePresence, motion } from 'framer-motion'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../contexts/I18nContext'
import { useAnnotatedVideo } from '../../hooks/useAnnotatedVideo'
import { deleteAnalysis, mediaUrl, videoUrl } from '../../services/api'
import type { AnalysisRecord, ApiError } from '../../types'
import { formatDateTime, formatProcessingTime, modelLabel } from '../../utils/formatters'
import { BoundingBoxOverlay } from '../result/BoundingBoxOverlay'
import { ColorPalette } from '../result/ColorPalette'
import { MusicList } from '../result/MusicList'
import { ObjectList } from '../result/ObjectList'
import { TranscriptKaraoke } from '../result/TranscriptKaraoke'
import { SceneBadge } from '../result/SceneBadge'
import { TagCloud } from '../result/TagCloud'
import { VideoPlayer } from '../result/VideoPlayer'
import { Button } from '../ui/Button'
import { ErrorBanner } from '../ui/ErrorBanner'
import { TypeBadge } from './TypeBadge'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="eyebrow">{title}</h3>
      {children}
    </div>
  )
}

function QuickLookContent({
  record,
  onClose,
  onDeleted,
}: {
  record: AnalysisRecord
  onClose: () => void
  onDeleted: (id: string) => void
}) {
  const { t, lang } = useI18n()
  const priorityLabels = useMemo(
    () => new Set((record.objects ?? []).filter((o) => o.priority !== false).map((o) => o.label)),
    [record.objects]
  )
  const av = useAnnotatedVideo(priorityLabels)
  const hasPlayer = Boolean(record.video_path)
  // Image annotée : mêmes boîtes interactives + filtre que dans le fil (parité avec la vidéo).
  const showImageBoxes =
    record.type === 'image' &&
    record.source_width !== null &&
    record.source_height !== null &&
    Boolean(record.thumbnail_path)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    setError(null)
    try {
      await deleteAnalysis(record.id)
      onDeleted(record.id)
    } catch (err) {
      setError((err as ApiError).message ?? t('history.delete.error'))
      setDeleting(false)
    }
  }

  return (
    <>
      {/* En-tête. */}
      <header className="flex items-center justify-between gap-3 border-b border-ink-200 px-5 py-4 dark:border-ink-800">
        <div className="flex items-center gap-2.5">
          <TypeBadge type={record.type} />
          <span className="text-sm text-ink-500 dark:text-ink-400">
            {formatDateTime(record.created_at, lang)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      {/* Corps défilant. */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="flex flex-col gap-6">
          {hasPlayer ? (
            <VideoPlayer
              src={videoUrl(record.request_id)}
              frames={record.frame_detections ?? []}
              sourceWidth={record.source_width}
              sourceHeight={record.source_height}
              {...av.player}
            />
          ) : showImageBoxes ? (
            <BoundingBoxOverlay
              src={mediaUrl(record.request_id)}
              objects={record.objects ?? []}
              sourceDims={{
                w: record.source_width as number,
                h: record.source_height as number,
              }}
            />
          ) : (
            record.thumbnail_path && (
              <img
                src={mediaUrl(record.request_id)}
                alt={t('history.thumbnailAlt')}
                className="max-h-72 w-full rounded-xl border border-ink-200 object-contain dark:border-ink-800"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )
          )}

          <Section title={t('result.description')}>
            <p className="text-[15px] leading-relaxed text-ink-700 dark:text-ink-200">
              {record.description}
            </p>
          </Section>

          <Section title={t('result.scene')}>
            <SceneBadge
              label={record.scene_label}
              confidence={record.scene_confidence}
              indoor={record.indoor}
            />
          </Section>

          {record.objects && record.objects.length > 0 && (
            <Section title={`${t('result.objects')} (${record.objects.length})`}>
              <ObjectList
                objects={record.objects}
                timeline={record.timeline}
                onSeek={hasPlayer ? av.seek : undefined}
                {...av.timeline}
              />
            </Section>
          )}

          {record.audio_transcript && (
            <Section title={t('transcript.title')}>
              <TranscriptKaraoke
                text={record.audio_transcript}
                segments={record.transcript_segments}
                timeRef={hasPlayer ? av.timeline.timeRef : undefined}
                playing={av.timeline.playing}
              />
            </Section>
          )}

          {record.music && record.music.length > 0 && (
            <Section title={t('music.title')}>
              <MusicList music={record.music} />
            </Section>
          )}

          {record.colors.length > 0 && (
            <Section title={t('result.colors')}>
              <ColorPalette colors={record.colors} />
            </Section>
          )}

          {record.tags.length > 0 && (
            <Section title={t('result.tags')}>
              <TagCloud tags={record.tags} />
            </Section>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-ink-100 pt-4 text-sm dark:border-ink-800">
            <Meta label={t('detail.meta.objects')} value={String(record.objects_count)} />
            <Meta label={t('detail.meta.duration')} value={formatProcessingTime(record.processing_time_ms)} />
            <Meta label={t('detail.meta.model')} value={modelLabel(record.type)} />
            <Meta label={t('detail.meta.lang')} value={record.lang.toUpperCase()} />
          </div>
        </div>
      </div>

      {/* Pied : actions. */}
      <footer className="flex flex-col gap-3 border-t border-ink-200 px-5 py-4 dark:border-ink-800">
        {error && <ErrorBanner error={error} />}
        <div className="flex items-center justify-between gap-3">
          <Link
            to={`/analysis/${record.id}`}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            {t('history.openDetail')} →
          </Link>

          {confirming ? (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                loading={deleting}
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                {t('history.delete')}
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirming(true)}
              className="text-red-600 hover:text-red-700 dark:text-red-400"
            >
              {t('history.delete')}
            </Button>
          )}
        </div>
      </footer>
    </>
  )
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-ink-400 dark:text-ink-500">{label}</span>
      <span className={`${mono ? 'font-mono ' : ''}break-all text-ink-700 dark:text-ink-200`}>
        {value}
      </span>
    </div>
  )
}

export function AnalysisQuickLook({
  record,
  onClose,
  onDeleted,
}: {
  record: AnalysisRecord | null
  onClose: () => void
  onDeleted: (id: string) => void
}) {
  const { t } = useI18n()

  // Fermeture au clavier (Échap) tant que le panneau est ouvert.
  useEffect(() => {
    if (!record) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [record, onClose])

  return (
    <AnimatePresence>
      {record && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-ink-950/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: 48 }}
            animate={{ x: 0 }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-ink-900"
          >
            <QuickLookContent record={record} onClose={onClose} onDeleted={onDeleted} />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
