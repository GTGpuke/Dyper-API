// Chronologie d'apparition des objets d'une vidéo : une bande de présence par label.
// Les échantillons consécutifs sont fusionnés en segments ; un trou > 1,5 × le pas
// d'échantillonnage ferme le segment.
import { useMemo, useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { TimelineEntry } from '../../types'
import { formatTimecode } from '../../utils/formatters'

const DEFAULT_MAX_ROWS = 8

interface Segment {
  start: number
  end: number
}

interface LabelTrack {
  label: string
  segments: Segment[]
  presence: number
}

// Construit les bandes de présence par label à partir des échantillons.
function buildTracks(timeline: TimelineEntry[]): { tracks: LabelTrack[]; total: number } {
  const times = timeline.map((e) => e.t).sort((a, b) => a - b)
  const deltas = times.slice(1).map((t, i) => t - times[i]).filter((d) => d > 0)
  const step = deltas.length > 0 ? deltas.sort((a, b) => a - b)[Math.floor(deltas.length / 2)] : 1
  const total = (times[times.length - 1] ?? 0) + step

  const samplesByLabel = new Map<string, number[]>()
  for (const entry of timeline) {
    for (const label of entry.labels) {
      samplesByLabel.set(label, [...(samplesByLabel.get(label) ?? []), entry.t])
    }
  }

  const tracks: LabelTrack[] = []
  for (const [label, samples] of samplesByLabel) {
    const sorted = [...samples].sort((a, b) => a - b)
    const segments: Segment[] = []
    let start = sorted[0]
    let last = sorted[0]
    for (const t of sorted.slice(1)) {
      if (t - last > step * 1.5) {
        segments.push({ start, end: Math.min(last + step, total) })
        start = t
      }
      last = t
    }
    segments.push({ start, end: Math.min(last + step, total) })
    const presence = segments.reduce((sum, s) => sum + (s.end - s.start), 0)
    tracks.push({ label, segments, presence })
  }

  tracks.sort((a, b) => b.presence - a.presence)
  return { tracks, total }
}

export function VideoTimeline({
  timeline,
  maxRows = DEFAULT_MAX_ROWS,
  onSeek,
}: {
  timeline: TimelineEntry[]
  maxRows?: number
  /** Si fourni, les segments deviennent cliquables et sautent le lecteur à leur début. */
  onSeek?: (time: number) => void
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const { tracks, total } = useMemo(() => buildTracks(timeline), [timeline])

  if (tracks.length === 0 || total <= 0) return null

  const visible = expanded ? tracks : tracks.slice(0, maxRows)
  const hidden = tracks.length - maxRows

  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((track) => (
        <div key={track.label} className="group flex items-center gap-3" tabIndex={0}>
          <span className="w-24 shrink-0 truncate text-xs capitalize text-ink-600 dark:text-ink-300">
            {track.label}
          </span>
          {/* Toute la barre est cliquable (seek positionnel) lorsque onSeek est fourni. */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: les segments internes restent focusables et actionnables au clavier. */}
          <div
            className={cn(
              'relative h-2.5 flex-1 rounded-full bg-ink-100 dark:bg-ink-800',
              onSeek && 'cursor-pointer'
            )}
            onClick={
              onSeek
                ? (e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    onSeek(((e.clientX - rect.left) / rect.width) * total)
                  }
                : undefined
            }
          >
            {track.segments.map((segment) => {
              const tooltip = `${track.label} · ${formatTimecode(segment.start)} – ${formatTimecode(segment.end)}`
              const style = {
                left: `${(segment.start / total) * 100}%`,
                width: `max(${((segment.end - segment.start) / total) * 100}%, 3px)`,
              }
              return onSeek ? (
                <button
                  key={`${segment.start}-${segment.end}`}
                  type="button"
                  onClick={(e) => {
                    // Seek positionnel : la position du clic dans la barre fait foi.
                    e.stopPropagation()
                    const bar = e.currentTarget.parentElement?.getBoundingClientRect()
                    if (bar) onSeek(((e.clientX - bar.left) / bar.width) * total)
                    else onSeek(segment.start)
                  }}
                  aria-label={tooltip}
                  title={tooltip}
                  className="absolute top-0 h-full cursor-pointer rounded-full bg-brand-500 transition-colors hover:bg-brand-600 dark:bg-brand-400"
                  style={style}
                />
              ) : (
                <span
                  key={`${segment.start}-${segment.end}`}
                  role="img"
                  aria-label={tooltip}
                  title={tooltip}
                  className="absolute top-0 h-full rounded-full bg-brand-500 transition-colors group-hover:bg-brand-600 dark:bg-brand-400"
                  style={style}
                />
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pl-[6.75rem] pr-0 text-[10px] text-ink-400 dark:text-ink-500">
        <span>0:00</span>
        <span>{formatTimecode(total / 2)}</span>
        <span>{formatTimecode(total)}</span>
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-xs text-brand-600 hover:underline dark:text-brand-400"
        >
          {expanded ? t('timeline.less') : t('timeline.more', { n: hidden })}
        </button>
      )}
    </div>
  )
}
