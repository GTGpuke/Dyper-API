// Indicateur d'analyse en cours : aperçu du média balayé par une ligne de scan, barre de
// progression (téléversement réel puis progression simulée) et étapes du pipeline.
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '../../contexts/I18nContext'

export interface AnalyzingPreview {
  url: string | null
  isVideo: boolean
  name: string | null
}

interface Props {
  preview: AnalyzingPreview | null
  /** Progression réelle du téléversement (0–100), null si pas de fichier. */
  uploadPct: number | null
}

// Étapes simulées du pipeline après le téléversement (clé i18n + part de progression).
const STAGES = [
  { key: 'analyzing.detect', until: 70 },
  { key: 'analyzing.colors', until: 85 },
  { key: 'analyzing.report', until: 95 },
]

// Part de la barre réservée au téléversement réel.
const UPLOAD_SHARE = 40

export function AnalyzingIndicator({ preview, uploadPct }: Props) {
  const { t } = useI18n()
  const [simulated, setSimulated] = useState(0)
  const uploadDone = uploadPct === null || uploadPct >= 100
  const startRef = useRef<number | null>(null)

  // Progression simulée après le téléversement : avance vite puis ralentit, plafonnée à 95 %.
  useEffect(() => {
    if (!uploadDone) return
    startRef.current = startRef.current ?? Date.now()
    const timer = setInterval(() => {
      const elapsed = (Date.now() - (startRef.current ?? Date.now())) / 1000
      // Courbe asymptotique : ~70 % à 5 s, ~90 % à 20 s, plafonnée à 95 %.
      const value = Math.min(95, UPLOAD_SHARE + (95 - UPLOAD_SHARE) * (1 - Math.exp(-elapsed / 8)))
      setSimulated(value)
    }, 200)
    return () => clearInterval(timer)
  }, [uploadDone])

  const pct = uploadDone ? Math.max(simulated, UPLOAD_SHARE) : (uploadPct / 100) * UPLOAD_SHARE
  const stage = !uploadDone
    ? 'analyzing.upload'
    : (STAGES.find((s) => pct < s.until) ?? STAGES[STAGES.length - 1]).key

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface flex max-w-xl items-center gap-4 p-4"
    >
      {/* Aperçu balayé par la ligne de scan. */}
      <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-ink-900">
        {preview?.url && !preview.isVideo ? (
          <img src={preview.url} alt="" className="h-full w-full object-cover opacity-80" />
        ) : (
          <div className="grid h-full w-full place-items-center text-ink-500">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              {preview?.isVideo ? (
                <path d="M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4-4" strokeLinecap="round" />
                </>
              )}
            </svg>
          </div>
        )}
        {/* Ligne de scan animée. */}
        <motion.div
          className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-brand-400/60 to-transparent"
          animate={{ top: ['-20%', '110%'] }}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.6, ease: 'easeInOut' }}
        />
      </div>

      {/* Étape + barre de progression. */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-700 dark:text-ink-200">
          {stage === 'analyzing.upload'
            ? t('analyzing.upload', { pct: uploadPct ?? 0 })
            : t(stage)}
        </p>
        {preview?.name && (
          <p className="truncate text-xs text-ink-400 dark:text-ink-500">{preview.name}</p>
        )}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
            animate={{ width: `${pct}%` }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  )
}
