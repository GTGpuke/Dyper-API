// Superpose les boîtes englobantes des objets détectés sur l'image analysée.
// Les coordonnées sont en pixels relatifs à la taille naturelle de l'image ; on les convertit en
// pourcentages pour rester responsive. Chaque objet a une teinte stable (accordée à la liste).
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import type { DetectedObject } from '../../types'
import { formatConfidence } from '../../utils/formatters'
import { labelColor } from '../../utils/labelColor'

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
  const dims = sourceDims ?? naturalDims
  const boxed = objects.filter((o) => o.boundingBox)

  return (
    <div className="relative overflow-hidden rounded-xl border border-ink-200 bg-ink-900">
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
            className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/75"
          >
            {visible ? t('result.boxes.hide') : t('result.boxes.show')}
          </button>
        </>
      )}

      {visible &&
        dims &&
        boxed.map((obj, i) => {
          const b = obj.boundingBox as NonNullable<DetectedObject['boundingBox']>
          const active = highlightIndex === i
          const color = labelColor(obj.label)
          return (
            <motion.div
              key={`${obj.label}-${i}`}
              onMouseEnter={() => onHover?.(i)}
              onMouseLeave={() => onHover?.(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="absolute rounded-[3px] border-2"
              style={{
                left: `${(b.x / dims.w) * 100}%`,
                top: `${(b.y / dims.h) * 100}%`,
                width: `${(b.w / dims.w) * 100}%`,
                height: `${(b.h / dims.h) * 100}%`,
                borderColor: color,
                boxShadow: active ? '0 0 0 9999px rgba(15,23,42,0.5)' : 'none',
              }}
            >
              <span
                className="absolute left-0 top-0 -translate-y-full whitespace-nowrap rounded-t px-1.5 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: color, color: '#0b1020' }}
              >
                {obj.label} · {formatConfidence(obj.confidence)}
              </span>
            </motion.div>
          )
        })}

      {dims && boxed.length === 0 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80">
          {t('result.noBoxes')}
        </div>
      )}
    </div>
  )
}
