// Objets détectés : vue unifiée et sobre. En vidéo, chaque objet porte sa bande de présence (la
// « chronologie d'apparition ») — cochable (visibilité dans le lecteur), cliquable (saut au
// segment), avec une tête de lecture synchronisée et son % de confiance. En image (sans
// chronologie), chaque objet montre sa barre de confiance. Volontairement MONOCHROME (teinte
// d'accent unique) : le code couleur par objet/piste est réservé aux boîtes du lecteur, pour ne
// pas surcharger cette liste. Les objets non prioritaires (vocabulaire ouvert sous le seuil) sont
// masqués par défaut et révélés à la demande.
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { DetectedObject, TimelineEntry } from '../../types'
import { formatTimecode } from '../../utils/formatters'
import { ConfidenceBar } from '../ui/ConfidenceBar'

interface Segment {
  start: number
  end: number
}

// Construit, par label, les segments de présence (échantillons consécutifs fusionnés ; un trou
// > 1,5 × le pas d'échantillonnage ferme un segment) et la durée totale de référence.
function buildPresence(timeline: TimelineEntry[]): {
  byLabel: Map<string, Segment[]>
  total: number
} {
  const times = timeline.map((e) => e.t).sort((a, b) => a - b)
  const deltas = times
    .slice(1)
    .map((t, i) => t - times[i])
    .filter((d) => d > 0)
  const step = deltas.length > 0 ? deltas.sort((a, b) => a - b)[Math.floor(deltas.length / 2)] : 1
  const total = (times[times.length - 1] ?? 0) + step

  const samplesByLabel = new Map<string, number[]>()
  for (const entry of timeline) {
    for (const label of entry.labels) {
      samplesByLabel.set(label, [...(samplesByLabel.get(label) ?? []), entry.t])
    }
  }

  const byLabel = new Map<string, Segment[]>()
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
    byLabel.set(label, segments)
  }
  return { byLabel, total }
}

const presenceOf = (segments: Segment[]): number =>
  segments.reduce((sum, s) => sum + (s.end - s.start), 0)

// Propriétés de coordination avec le lecteur vidéo (cf. useAnnotatedVideo), inertes en mode image.
interface AnnotatedProps {
  /** Durée réelle de la vidéo (s) : axe de référence, sinon repli sur le dernier échantillon. */
  duration?: number
  /** Si fourni, les bandes deviennent cliquables et sautent le lecteur. */
  onSeek?: (time: number) => void
  /** Position de lecture courante (s) publiée par le lecteur — anime la tête de lecture. */
  timeRef?: MutableRefObject<number>
  /** Vrai pendant la lecture (déclenche le balayage de la tête de lecture). */
  playing?: boolean
  /** Labels prioritaires (cochés par défaut) ; les autres sont décochés/masqués. */
  priorityLabels?: ReadonlySet<string>
  /** Dérogations de visibilité par label (choix explicites de l'utilisateur). */
  overrides?: ReadonlyMap<string, boolean>
  /** Bascule la visibilité d'un label (partagée avec le lecteur). */
  onToggle?: (label: string) => void
  /** Rend tous les labels listés visibles. */
  onShowAll?: (labels: readonly string[]) => void
}

export function ObjectList({
  objects,
  timeline,
  highlightIndex,
  onHover,
  ...annotated
}: {
  objects: DetectedObject[]
  /** Chronologie d'apparition (vidéo) : active les bandes de présence par objet. */
  timeline?: TimelineEntry[] | null
  highlightIndex?: number | null
  onHover?: (index: number | null) => void
} & AnnotatedProps) {
  // Vidéo (chronologie disponible) → bandes de présence par objet ; image → barres de confiance.
  if (timeline && timeline.length > 0) {
    return <ObjectTimeline objects={objects} timeline={timeline} {...annotated} />
  }
  return <ObjectConfidenceList objects={objects} highlightIndex={highlightIndex} onHover={onHover} />
}

// Mode vidéo : une ligne par objet (case + label + % + bande de présence), triée prioritaires
// d'abord puis par temps de présence ; tête de lecture synchronisée. Bande d'accent monochrome.
function ObjectTimeline({
  objects,
  timeline,
  duration = 0,
  onSeek,
  timeRef,
  playing = false,
  priorityLabels,
  overrides,
  onToggle,
  onShowAll,
}: { objects: DetectedObject[]; timeline: TimelineEntry[] } & AnnotatedProps) {
  const { t } = useI18n()
  const [showSecondary, setShowSecondary] = useState(false)
  const headRef = useRef<HTMLDivElement>(null)
  const { byLabel, total } = useMemo(() => buildPresence(timeline), [timeline])

  // Une ligne par objet (label unique) : confiance/priorité issues des objets, segments de la
  // chronologie. Tri : prioritaires d'abord, puis par présence décroissante (les plus à l'écran).
  const rows = useMemo(
    () =>
      objects
        .map((obj) => {
          const segments = byLabel.get(obj.label) ?? []
          return { obj, segments, presence: presenceOf(segments) }
        })
        .sort(
          (a, b) =>
            Number(b.obj.priority !== false) - Number(a.obj.priority !== false) ||
            b.presence - a.presence
        ),
    [objects, byLabel]
  )

  // Axe temporel : durée réelle du lecteur si connue, sinon dernier échantillon analysé.
  const axis = duration > 0 ? duration : total
  const showPlayhead = Boolean(onSeek && timeRef)

  // Visibilité effective d'un label : dérogation explicite, sinon priorité (défaut), sinon visible.
  const isVisible = useCallback(
    (label: string) => overrides?.get(label) ?? priorityLabels?.has(label) ?? true,
    [overrides, priorityLabels]
  )

  // Positionne la tête de lecture (impératif : aucun re-render pendant la lecture).
  const setHead = useCallback((fraction: number) => {
    const el = headRef.current
    if (el) el.style.left = `${Math.max(0, Math.min(1, fraction)) * 100}%`
  }, [])

  // Balaie la tête pendant la lecture ; à l'arrêt, la cale une fois sur la position courante.
  useEffect(() => {
    if (!showPlayhead || !timeRef || axis <= 0) return
    if (!playing) {
      setHead(timeRef.current / axis)
      return
    }
    let raf = 0
    const tick = () => {
      setHead(timeRef.current / axis)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, showPlayhead, timeRef, axis, setHead])

  // Seek positionnel : la position du clic dans la bande fait foi (et cale la tête aussitôt).
  const seekAt = useCallback(
    (clientX: number, rect: DOMRect) => {
      if (!onSeek) return
      const fraction = (clientX - rect.left) / rect.width
      setHead(fraction)
      onSeek(fraction * axis)
    },
    [onSeek, axis, setHead]
  )

  if (rows.length === 0 || axis <= 0) return null

  const secondaryCount = rows.filter((r) => r.obj.priority === false).length
  const visibleRows = showSecondary ? rows : rows.filter((r) => r.obj.priority !== false)
  // « Tout afficher » n'apparaît que si une ligne actuellement listée est masquée (décochée).
  const hasHidden = visibleRows.some((r) => !isVisible(r.obj.label))

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative flex flex-col gap-1.5">
        {visibleRows.map(({ obj, segments }) => {
          const shown = isVisible(obj.label)
          return (
            <div
              key={obj.label}
              className={cn(
                'group flex items-center gap-3 transition-opacity',
                !shown && 'opacity-40'
              )}
            >
              <label className="flex w-44 shrink-0 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={() => onToggle?.(obj.label)}
                  className="h-3 w-3 shrink-0 cursor-pointer accent-brand-600"
                />
                <span className="flex-1 truncate text-xs capitalize text-ink-600 dark:text-ink-300">
                  {obj.label}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-ink-400 dark:text-ink-500">
                  {Math.round(obj.confidence * 100)}%
                </span>
              </label>
              {/* Toute la bande est cliquable (seek positionnel) lorsque onSeek est fourni. */}
              <div
                className={cn(
                  'relative h-2.5 flex-1 rounded-full bg-ink-100 dark:bg-ink-800',
                  onSeek && 'cursor-pointer'
                )}
                onClick={
                  onSeek
                    ? (e) => seekAt(e.clientX, e.currentTarget.getBoundingClientRect())
                    : undefined
                }
              >
                {segments.map((segment) => {
                  const tooltip = `${obj.label} · ${formatTimecode(segment.start)} – ${formatTimecode(segment.end)}`
                  const style = {
                    left: `${(segment.start / axis) * 100}%`,
                    width: `max(${((segment.end - segment.start) / axis) * 100}%, 3px)`,
                  }
                  return onSeek ? (
                    <button
                      key={`${segment.start}-${segment.end}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const bar = e.currentTarget.parentElement?.getBoundingClientRect()
                        if (bar) seekAt(e.clientX, bar)
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
          )
        })}

        {/* Tête de lecture synchronisée (zone des bandes uniquement, alignée sur pl-[11.75rem]). */}
        {showPlayhead && (
          <div className="pointer-events-none absolute inset-y-0 left-[11.75rem] right-0">
            {/* `left` est piloté en impératif (setHead) — pas de style React, sinon un re-render
                le remettrait à zéro pendant que la vidéo est en pause. */}
            <div
              ref={headRef}
              className="absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-ink-900/70 dark:bg-white/80"
            >
              <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-ink-900 shadow-sm dark:bg-white" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pl-[11.75rem] text-[10px] text-ink-400 dark:text-ink-500">
        <span>0:00</span>
        <span>{formatTimecode(axis / 2)}</span>
        <span>{formatTimecode(axis)}</span>
      </div>

      {(secondaryCount > 0 || (hasHidden && onShowAll)) && (
        <div className="flex items-center gap-3">
          {secondaryCount > 0 && (
            <button
              type="button"
              onClick={() => setShowSecondary((v) => !v)}
              className="text-xs text-ink-400 hover:text-ink-700 hover:underline dark:text-ink-500 dark:hover:text-ink-200"
            >
              {showSecondary
                ? t('objects.hideSecondary')
                : t('objects.showSecondary', { n: secondaryCount })}
            </button>
          )}
          {hasHidden && onShowAll && (
            <button
              type="button"
              onClick={() => onShowAll(visibleRows.map((r) => r.obj.label))}
              className="text-xs text-ink-400 hover:text-ink-700 hover:underline dark:text-ink-500 dark:hover:text-ink-200"
            >
              {t('filter.showAll')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Mode image (sans chronologie) : liste des objets avec label et barre de confiance, triés par
// score décroissant ; les non prioritaires sont masqués par défaut. Sobre, sans pastille de couleur.
function ObjectConfidenceList({
  objects,
  highlightIndex,
  onHover,
}: {
  objects: DetectedObject[]
  highlightIndex?: number | null
  onHover?: (index: number | null) => void
}) {
  const { t } = useI18n()
  const [showSecondary, setShowSecondary] = useState(false)
  const sorted = [...objects].sort((a, b) => b.confidence - a.confidence)
  const secondaryCount = sorted.filter((o) => o.priority === false).length

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-ink-100 dark:divide-ink-800">
        {sorted.map((obj, i) => {
          // Objet non prioritaire masqué par défaut (l'index est conservé pour le survol croisé).
          if (obj.priority === false && !showSecondary) return null
          return (
            <li
              key={`${obj.label}-${i}`}
              onMouseEnter={() => onHover?.(i)}
              onMouseLeave={() => onHover?.(null)}
              className={cn(
                'flex items-center gap-3 py-2.5 transition-colors',
                highlightIndex === i && 'bg-brand-50/60 dark:bg-brand-600/10',
                obj.priority === false && 'opacity-60'
              )}
            >
              <span className="w-32 shrink-0 truncate text-sm font-medium capitalize text-ink-700 dark:text-ink-200">
                {obj.label}
              </span>
              <ConfidenceBar value={obj.confidence} className="flex-1" />
            </li>
          )
        })}
      </ul>

      {secondaryCount > 0 && (
        <button
          type="button"
          onClick={() => setShowSecondary((v) => !v)}
          className="self-start text-xs text-ink-400 hover:text-ink-700 hover:underline dark:text-ink-500 dark:hover:text-ink-200"
        >
          {showSecondary
            ? t('objects.hideSecondary')
            : t('objects.showSecondary', { n: secondaryCount })}
        </button>
      )}
    </div>
  )
}
