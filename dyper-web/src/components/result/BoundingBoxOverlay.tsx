// Superpose les boîtes englobantes des objets détectés sur l'image analysée.
// Les coordonnées sont en pixels relatifs à la taille naturelle de l'image ; on les convertit en
// pourcentages pour rester responsive. Chaque objet a une teinte stable (accordée à la liste).
// Un filtre par label (cases à cocher) contrôle la visibilité : les labels non prioritaires
// (vocabulaire ouvert sous le seuil) sont décochés — donc masqués — par défaut, mais activables.
import { useCallback, useMemo, useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { DetectedObject } from '../../types'
import { formatConfidence } from '../../utils/formatters'
import { labelColor } from '../../utils/labelColor'
import { DetectionBox } from './DetectionBox'

interface Props {
  src: string
  objects: DetectedObject[]
  highlightIndex?: number | null
  onHover?: (index: number | null) => void
  /**
   * Dimensions de l'image d'origine (référentiel des boîtes). Indispensable quand `src` est
   * une miniature réduite : sans elles, les pourcentages seraient calculés sur la miniature.
   */
  sourceDims?: { w: number; h: number }
}

export function BoundingBoxOverlay({ src, objects, highlightIndex, onHover, sourceDims }: Props) {
  const { t } = useI18n()
  const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null)
  const [visible, setVisible] = useState(true)
  // Choix explicites de l'utilisateur (label → visible) ; en l'absence, le défaut suit la priorité.
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(() => new Map())
  const dims = sourceDims ?? naturalDims

  const boxed = useMemo(() => objects.filter((o) => o.boundingBox), [objects])
  // Labels uniques (décompte + priorité : au moins une détection prioritaire).
  const labels = useMemo(() => {
    const map = new Map<string, { count: number; priority: boolean }>()
    for (const o of boxed) {
      const entry = map.get(o.label) ?? { count: 0, priority: false }
      entry.count += 1
      if (o.priority !== false) entry.priority = true
      map.set(o.label, entry)
    }
    return [...map.entries()]
      .map(([label, entry]) => ({ label, count: entry.count, priority: entry.priority }))
      .sort((a, b) => b.count - a.count)
  }, [boxed])

  const defaultVisible = useMemo(() => new Map(labels.map((l) => [l.label, l.priority])), [labels])
  const isVisible = useCallback(
    (label: string) => overrides.get(label) ?? defaultVisible.get(label) ?? true,
    [overrides, defaultVisible]
  )
  const toggle = useCallback(
    (label: string) => {
      setOverrides((prev) => {
        const next = new Map(prev)
        next.set(label, !(prev.get(label) ?? defaultVisible.get(label) ?? true))
        return next
      })
    },
    [defaultVisible]
  )
  const hasHidden = labels.some((l) => !isVisible(l.label))

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl bg-ink-950">
        <img
          src={src}
          alt=""
          className="block max-h-[480px] w-full object-contain"
          onLoad={(e) =>
            setNaturalDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
          }
        />

        {/* Compteur d'objets + bascule d'affichage des boîtes. */}
        {boxed.length > 0 && (
          <>
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {t('card.stat.objects')} · {boxed.length}
            </span>
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? t('result.boxes.hide') : t('result.boxes.show')}
              title={visible ? t('result.boxes.hide') : t('result.boxes.show')}
              className={cn(
                'absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 backdrop-blur-sm transition-colors hover:bg-black/75',
                visible ? 'text-white' : 'text-white/50'
              )}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <rect x="8" y="8" width="8" height="8" rx="1" strokeDasharray="3 2" />
              </svg>
            </button>
          </>
        )}

        {visible &&
          dims &&
          boxed.map((obj, i) => {
            // Visibilité par label : les non prioritaires sont masqués tant qu'ils ne sont pas
            // cochés (l'index `i` reste celui de `boxed` — survol croisé avec la liste préservé).
            if (!isVisible(obj.label)) return null
            const b = obj.boundingBox as NonNullable<DetectedObject['boundingBox']>
            return (
              <DetectionBox
                key={`${obj.label}-${i}`}
                leftPct={(b.x / dims.w) * 100}
                topPct={(b.y / dims.h) * 100}
                widthPct={(b.w / dims.w) * 100}
                heightPct={(b.h / dims.h) * 100}
                color={labelColor(obj.label)}
                label={obj.label}
                sublabel={formatConfidence(obj.confidence)}
                active={highlightIndex === i}
                onMouseEnter={() => onHover?.(i)}
                onMouseLeave={() => onHover?.(null)}
              />
            )
          })}

        {dims && boxed.length === 0 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80">
            {t('result.noBoxes')}
          </div>
        )}
      </div>

      {/* Filtre de visibilité par label (non prioritaires décochés par défaut). */}
      {visible && labels.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {labels.map(({ label, count }) => {
            const shown = isVisible(label)
            return (
              <label
                key={label}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 text-xs transition-opacity',
                  !shown && 'opacity-50'
                )}
              >
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={() => toggle(label)}
                  className="h-3 w-3 shrink-0 cursor-pointer"
                  style={{ accentColor: labelColor(label) }}
                />
                <span className="capitalize text-ink-600 dark:text-ink-300">{label}</span>
                <span className="text-ink-400 dark:text-ink-500">{count}</span>
              </label>
            )
          })}
          {hasHidden && (
            <button
              type="button"
              onClick={() => setOverrides(new Map(labels.map((l) => [l.label, true])))}
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
