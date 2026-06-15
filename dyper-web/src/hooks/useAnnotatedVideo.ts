// Coordination lecteur vidéo annoté ↔ chronologie : expose au lecteur de quoi piloter le seek,
// publier sa position de lecture (sans re-render) et l'état de lecture ; partage la visibilité
// des labels (les non prioritaires sont décochés par défaut) entre la chronologie et le lecteur.
import { useCallback, useRef, useState, type MutableRefObject } from 'react'

export interface AnnotatedVideoPlayerProps {
  seekRef: MutableRefObject<((time: number) => void) | null>
  /** Position de lecture courante (s), écrite en continu par le lecteur — lue par la chronologie. */
  timeRef: MutableRefObject<number>
  onPlayingChange: (playing: boolean) => void
  onDuration: (duration: number) => void
  /** Labels prioritaires (confiance ≥ seuil) : visibles par défaut. */
  priorityLabels: ReadonlySet<string>
  /** Dérogations de visibilité par label (choix explicites de l'utilisateur). */
  overrides: ReadonlyMap<string, boolean>
}

export interface AnnotatedVideoTimelineProps {
  timeRef: MutableRefObject<number>
  playing: boolean
  duration: number
  priorityLabels: ReadonlySet<string>
  overrides: ReadonlyMap<string, boolean>
  onToggle: (label: string) => void
  onShowAll: (labels: readonly string[]) => void
}

export interface AnnotatedVideo {
  /** Saute le lecteur à un instant (passé à `onSeek` de la chronologie quand un lecteur existe). */
  seek: (time: number) => void
  player: AnnotatedVideoPlayerProps
  timeline: AnnotatedVideoTimelineProps
}

export function useAnnotatedVideo(priorityLabels: ReadonlySet<string>): AnnotatedVideo {
  const seekRef = useRef<((time: number) => void) | null>(null)
  const timeRef = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(() => new Map())

  const seek = useCallback((time: number) => seekRef.current?.(time), [])

  const onToggle = useCallback(
    (label: string) => {
      setOverrides((prev) => {
        const next = new Map(prev)
        next.set(label, !(prev.get(label) ?? priorityLabels.has(label)))
        return next
      })
    },
    [priorityLabels]
  )

  const onShowAll = useCallback((labels: readonly string[]) => {
    setOverrides(new Map(labels.map((label) => [label, true])))
  }, [])

  return {
    seek,
    player: {
      seekRef,
      timeRef,
      onPlayingChange: setPlaying,
      onDuration: setDuration,
      priorityLabels,
      overrides,
    },
    timeline: { timeRef, playing, duration, priorityLabels, overrides, onToggle, onShowAll },
  }
}
