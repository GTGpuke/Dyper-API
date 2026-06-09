// Superpose les boîtes englobantes des objets détectés sur l'image analysée.
// Les coordonnées sont en pixels relatifs à la taille naturelle de l'image ;
// on les convertit en pourcentages pour rester responsive.
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '../../contexts/I18nContext'
import type { DetectedObject } from '../../types'
import { formatConfidence } from '../../utils/formatters'

interface Props {
  src: string
  objects: DetectedObject[]
  highlightIndex?: number | null
  onHover?: (index: number | null) => void
}

export function BoundingBoxOverlay({ src, objects, highlightIndex, onHover }: Props) {
  const { t } = useI18n()
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const boxed = objects.filter((o) => o.boundingBox)

  return (
    <div className="relative overflow-hidden rounded-xl border border-ink-200 bg-ink-900">
      <img
        src={src}
        alt=""
        className="block max-h-[480px] w-full object-contain"
        onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
      />
      {dims &&
        boxed.map((obj, i) => {
          const b = obj.boundingBox!
          const active = highlightIndex === i
          return (
            <motion.div
              key={`${obj.label}-${i}`}
              onMouseEnter={() => onHover?.(i)}
              onMouseLeave={() => onHover?.(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="absolute border-2"
              style={{
                left: `${(b.x / dims.w) * 100}%`,
                top: `${(b.y / dims.h) * 100}%`,
                width: `${(b.w / dims.w) * 100}%`,
                height: `${(b.h / dims.h) * 100}%`,
                borderColor: active ? '#4f46e5' : 'rgba(255,255,255,0.85)',
                boxShadow: active ? '0 0 0 9999px rgba(15,23,42,0.45)' : 'none',
              }}
            >
              <span
                className="absolute left-0 top-0 -translate-y-full whitespace-nowrap rounded-t px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: active ? '#4f46e5' : 'rgba(15,23,42,0.8)' }}
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
