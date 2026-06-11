// Lecteur vidéo annoté : rejoue la vidéo originale avec les cadres de détection superposés,
// synchronisés sur les frames analysées (couleur stable par piste trackée). Contrôles complets :
// lecture, barre de seek, pas avant/arrière d'un échantillon, vitesse, son, bascule des cadres.
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { FrameDetections } from '../../types'
import { formatTimecode } from '../../utils/formatters'

// Palette cyclique : une couleur stable par identifiant de piste.
const TRACK_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#06b6d4',
  '#d946ef',
  '#84cc16',
  '#f97316',
]

const SPEEDS = [0.5, 1, 1.5, 2]

interface Props {
  src: string
  frames: FrameDetections[]
  sourceWidth: number | null
  sourceHeight: number | null
  className?: string
  /** Rempli par le lecteur avec sa fonction de seek (chronologie cliquable du parent). */
  seekRef?: MutableRefObject<((time: number) => void) | null>
}

/** Index du dernier échantillon dont l'horodatage précède le temps courant (recherche binaire). */
function activeFrameIndex(frames: FrameDetections[], time: number): number {
  let low = 0
  let high = frames.length - 1
  let best = 0
  while (low <= high) {
    const mid = (low + high) >> 1
    if (frames[mid].t <= time) {
      best = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return best
}

export function VideoPlayer({ src, frames, sourceWidth, sourceHeight, className, seekRef }: Props) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number>(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [muted, setMuted] = useState(false)
  const [showBoxes, setShowBoxes] = useState(true)

  // Pas d'échantillonnage (médiane des écarts) pour la navigation frame analysée par frame.
  const sampleStep = useMemo(() => {
    if (frames.length < 2) return 1
    const gaps = frames
      .slice(1)
      .map((frame, i) => frame.t - frames[i].t)
      .sort((a, b) => a - b)
    return gaps[Math.floor(gaps.length / 2)] || 1
  }, [frames])

  // Boucle rAF pendant la lecture : les cadres suivent le temps réel (timeupdate est trop lent).
  useEffect(() => {
    if (!playing) return
    const tick = () => {
      const video = videoRef.current
      if (video) setCurrentTime(video.currentTime)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing])

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(time, video.duration || time))
    setCurrentTime(video.currentTime)
  }, [])

  // Expose la fonction de seek au parent (clic sur un segment de la chronologie).
  useEffect(() => {
    if (!seekRef) return
    seekRef.current = seekTo
    return () => {
      seekRef.current = null
    }
  }, [seekRef, seekTo])

  function togglePlay(): void {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  function cycleSpeed(): void {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    if (videoRef.current) videoRef.current.playbackRate = next
  }

  const active = frames.length > 0 ? frames[activeFrameIndex(frames, currentTime)] : null
  const hasDims = Boolean(sourceWidth && sourceHeight)

  return (
    <div className={cn('overflow-hidden rounded-xl bg-ink-950', className)}>
      {/* Vidéo + calque des cadres (l'élément suit le ratio natif : pas de letterbox). */}
      <div className="relative">
        {/* biome-ignore lint/a11y/useMediaCaption: vidéo utilisateur, sans piste de sous-titres. */}
        <video
          ref={videoRef}
          src={src}
          muted={muted}
          playsInline
          preload="metadata"
          className="block w-full"
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => {
            if (!playing) setCurrentTime(e.currentTarget.currentTime)
          }}
        />
        {showBoxes && hasDims && active && (
          <div className="pointer-events-none absolute inset-0">
            {active.objects.map((obj, index) => {
              if (!obj.boundingBox) return null
              const color = TRACK_COLORS[(obj.trackId ?? index) % TRACK_COLORS.length]
              // Le label reste dans le cadre vidéo : à l'intérieur de la boîte près du bord
              // supérieur, ancré à droite près du bord droit (sinon il serait coupé).
              const nearTop = obj.boundingBox.y / (sourceHeight as number) < 0.06
              const nearRight =
                (obj.boundingBox.x + obj.boundingBox.w) / (sourceWidth as number) > 0.85
              return (
                <div
                  key={`${obj.trackId ?? obj.label}-${index}`}
                  className="absolute rounded-sm border-2"
                  style={{
                    borderColor: color,
                    left: `${(obj.boundingBox.x / (sourceWidth as number)) * 100}%`,
                    top: `${(obj.boundingBox.y / (sourceHeight as number)) * 100}%`,
                    width: `${(obj.boundingBox.w / (sourceWidth as number)) * 100}%`,
                    height: `${(obj.boundingBox.h / (sourceHeight as number)) * 100}%`,
                  }}
                >
                  <span
                    className={cn(
                      'absolute whitespace-nowrap rounded px-1 font-mono text-[10px] font-semibold text-white',
                      nearTop ? 'top-0' : '-top-5',
                      nearRight ? 'right-0' : 'left-0'
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {obj.label}
                    {obj.trackId !== null && obj.trackId !== undefined && ` #${obj.trackId}`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Contrôles. */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 text-ink-200">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? t('player.pause') : t('player.play')}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10"
        >
          {playing ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.5v13a1 1 0 001.54.84l10-6.5a1 1 0 000-1.68l-10-6.5A1 1 0 008 5.5z" />
            </svg>
          )}
        </button>

        {/* Pas arrière / avant d'un échantillon analysé. */}
        <button
          type="button"
          onClick={() => seekTo(currentTime - sampleStep)}
          aria-label={t('player.prevFrame')}
          title={t('player.prevFrame')}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 19l-7-7 7-7M20 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => seekTo(currentTime + sampleStep)}
          aria-label={t('player.nextFrame')}
          title={t('player.nextFrame')}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 5l7 7-7 7M4 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <span className="ml-1 font-mono text-[11px] tabular-nums text-ink-300">
          {formatTimecode(currentTime)} / {formatTimecode(duration)}
        </span>

        {/* Barre de seek. */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={Math.min(currentTime, duration || 1)}
          onChange={(e) => seekTo(Number(e.target.value))}
          aria-label={t('player.seek')}
          className="mx-2 h-1.5 min-w-[80px] flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-brand-500"
        />

        {/* Vitesse de lecture. */}
        <button
          type="button"
          onClick={cycleSpeed}
          aria-label={t('player.speed')}
          title={t('player.speed')}
          className="rounded-lg px-2 py-1 font-mono text-[11px] hover:bg-white/10"
        >
          {speed}×
        </button>

        {/* Son. */}
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? t('player.unmute') : t('player.mute')}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10"
        >
          {muted ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Bascule de l'affichage des cadres. */}
        <button
          type="button"
          onClick={() => setShowBoxes((s) => !s)}
          aria-label={t('player.toggleBoxes')}
          title={t('player.toggleBoxes')}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10',
            showBoxes ? 'text-brand-400' : 'text-ink-500'
          )}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <rect x="8" y="8" width="8" height="8" rx="1" strokeDasharray="3 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

