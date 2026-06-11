// Indicateur d'analyse vivant : aperçu réel du média (image ou vidéo) balayé par une ligne
// de scan, phrases techniques et clins d'œil en rotation, barre calibrée sur la durée estimée
// du traitement, temps écoulé et avertissement de durée pour les vidéos.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useI18n } from '../../contexts/I18nContext'
import { formatTimecode } from '../../utils/formatters'

export interface AnalyzingPreview {
  url: string | null
  isVideo: boolean
  name: string | null
  /** Durée de la vidéo (s) si connue — calibre l'estimation de progression. */
  durationS: number | null
}

interface Props {
  preview: AnalyzingPreview | null
  /** Progression réelle du téléversement (0–100), null si pas de fichier. */
  uploadPct: number | null
}

// Part de la barre réservée au téléversement réel ; le reste suit l'estimation.
const UPLOAD_SHARE = 30

// Alternance de phrases : étapes techniques réelles et clins d'œil.
const PHRASES_IMAGE = ['analyzing.detect', 'analyzing.fun1', 'analyzing.colors', 'analyzing.fun2', 'analyzing.report']
const PHRASES_VIDEO = [
  'analyzing.detect',
  'analyzing.fun1',
  'analyzing.transcribe',
  'analyzing.fun3',
  'analyzing.chapters',
  'analyzing.fun4',
  'analyzing.colors',
  'analyzing.fun5',
  'analyzing.report',
  'analyzing.fun6',
]

// Estimation de la durée de traitement (secondes) selon le média.
function estimateProcessing(preview: AnalyzingPreview | null): number {
  if (!preview?.isVideo) return 8
  if (preview.durationS) return 25 + preview.durationS * 0.5
  // Lien de plateforme : durée inconnue (téléchargement + analyse).
  return 150
}

export function AnalyzingIndicator({ preview, uploadPct }: Props) {
  const { t } = useI18n()
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)
  const uploadDone = uploadPct === null || uploadPct >= 100

  // Horloge du temps écoulé (démarre à la fin du téléversement pour l'estimation).
  useEffect(() => {
    if (!uploadDone) return
    startRef.current = startRef.current ?? Date.now()
    const timer = setInterval(() => {
      setElapsed((Date.now() - (startRef.current ?? Date.now())) / 1000)
    }, 500)
    return () => clearInterval(timer)
  }, [uploadDone])

  const estimate = estimateProcessing(preview)
  const pct = uploadDone
    ? Math.min(95, UPLOAD_SHARE + (95 - UPLOAD_SHARE) * Math.min(1, elapsed / estimate))
    : ((uploadPct ?? 0) / 100) * UPLOAD_SHARE

  // Rotation des phrases (~3,5 s), téléversement affiché en priorité.
  const phrases = preview?.isVideo ? PHRASES_VIDEO : PHRASES_IMAGE
  const phraseKey = uploadDone
    ? phrases[Math.floor(elapsed / 3.5) % phrases.length]
    : 'analyzing.upload'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface flex max-w-xl flex-col gap-3 p-4"
    >
      <div className="flex items-center gap-4">
        {/* Aperçu réel du média, balayé par la ligne de scan. */}
        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-ink-900">
          {preview?.url ? (
            preview.isVideo ? (
              <video
                src={preview.url}
                muted
                loop
                autoPlay
                playsInline
                className="h-full w-full object-cover opacity-90"
              />
            ) : (
              <img src={preview.url} alt="" className="h-full w-full object-cover opacity-90" />
            )
          ) : (
            <div className="grid h-full w-full place-items-center text-ink-500">
              <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
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
            className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-violet-400/60 to-transparent"
            animate={{ top: ['-25%', '110%'] }}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.8, ease: 'easeInOut' }}
          />
        </div>

        <div className="min-w-0 flex-1">
          {/* Phrase en rotation (technique ↔ clin d'œil), avec fondu. */}
          <div className="h-5 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={phraseKey + (uploadPct ?? '')}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="truncate text-sm font-medium text-ink-700 dark:text-ink-200"
              >
                {phraseKey === 'analyzing.upload'
                  ? t('analyzing.upload', { pct: uploadPct ?? 0 })
                  : t(phraseKey)}
              </motion.p>
            </AnimatePresence>
          </div>
          {preview?.name && (
            <p className="truncate text-xs text-ink-400 dark:text-ink-500">{preview.name}</p>
          )}

          {/* Barre calibrée sur la durée estimée + temps écoulé. */}
          <div className="mt-2 flex items-center gap-2.5">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                animate={{ width: `${pct}%` }}
                transition={{ ease: 'easeOut', duration: 0.4 }}
              />
            </div>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-400 dark:text-ink-500">
              {formatTimecode(elapsed)}
            </span>
          </div>
        </div>
      </div>

      {/* Avertissement de durée : l'analyse approfondie d'une vidéo est longue, c'est normal. */}
      {preview?.isVideo && (
        <p className="border-t border-ink-100 pt-2.5 text-xs leading-relaxed text-ink-400 dark:border-ink-800 dark:text-ink-500">
          ⏳ {t('analyzing.longNotice')}
        </p>
      )}
    </motion.div>
  )
}
