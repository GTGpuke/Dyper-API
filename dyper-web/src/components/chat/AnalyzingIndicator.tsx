// Indicateur d'analyse vivant : aperçu réel du média balayé par un réticule de scan, frise de
// pipeline qui s'allume étape par étape, phrases techniques et clins d'œil en rotation, barre
// calibrée sur la durée estimée, temps écoulé et avertissement de durée pour les vidéos.
import { AnimatePresence, motion } from 'framer-motion'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
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
  'analyzing.fun4',
  'analyzing.colors',
  'analyzing.fun5',
  'analyzing.report',
  'analyzing.fun6',
]

// Étapes réelles du pipeline (frise) selon le média.
const STEPS_IMAGE = ['analyzing.step.detect', 'analyzing.step.scene', 'analyzing.step.report']
const STEPS_VIDEO = [
  'analyzing.step.detect',
  'analyzing.step.scene',
  'analyzing.step.transcribe',
  'analyzing.step.report',
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

  // Étape active de la frise, calée sur la fraction de progression post-téléversement.
  const steps = preview?.isVideo ? STEPS_VIDEO : STEPS_IMAGE
  const fraction = Math.max(0, pct - UPLOAD_SHARE) / (95 - UPLOAD_SHARE)
  const activeStep = uploadDone ? Math.min(steps.length - 1, Math.floor(fraction * steps.length)) : -1

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface flex max-w-xl flex-col gap-4 p-4"
    >
      <div className="flex items-center gap-4">
        {/* Aperçu réel du média, balayé par le réticule de scan. */}
        <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl bg-ink-900 ring-1 ring-violet-500/30">
          {preview?.url ? (
            preview.isVideo ? (
              <video
                src={preview.url}
                muted
                loop
                autoPlay
                playsInline
                className="h-full w-full object-cover opacity-90"
              >
                <track kind="captions" />
              </video>
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

          {/* Réticule : coins + ligne de scan animée. */}
          <span className="pointer-events-none absolute left-1.5 top-1.5 h-3 w-3 border-l-2 border-t-2 border-violet-300/80" />
          <span className="pointer-events-none absolute right-1.5 top-1.5 h-3 w-3 border-r-2 border-t-2 border-violet-300/80" />
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-3 w-3 border-b-2 border-l-2 border-violet-300/80" />
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-3 w-3 border-b-2 border-r-2 border-violet-300/80" />
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

          {/* Barre calibrée sur la durée estimée (shimmer) + temps écoulé. */}
          <div className="mt-2 flex items-center gap-2.5">
            <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                animate={{ width: `${pct}%` }}
                transition={{ ease: 'easeOut', duration: 0.4 }}
              />
              <motion.div
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                animate={{ left: ['-33%', '100%'] }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.4, ease: 'easeInOut' }}
              />
            </div>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-400 dark:text-ink-500">
              {formatTimecode(elapsed)}
            </span>
          </div>
        </div>
      </div>

      {/* Frise du pipeline : étapes réelles qui s'allument. */}
      <ol className="flex items-center gap-1.5 border-t border-ink-100 pt-3 dark:border-ink-800">
        {steps.map((key, i) => {
          const done = i < activeStep
          const active = i === activeStep
          return (
            <Fragment key={key}>
              {i > 0 && (
                <span
                  className={cn(
                    'h-px min-w-3 flex-1 transition-colors',
                    i <= activeStep ? 'bg-brand-400' : 'bg-ink-200 dark:bg-ink-700'
                  )}
                />
              )}
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold transition-colors',
                    done
                      ? 'bg-emerald-500 text-white'
                      : active
                        ? 'animate-pulse bg-brand-500 text-white'
                        : 'bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500'
                  )}
                >
                  {done ? (
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    'hidden whitespace-nowrap text-xs sm:inline',
                    active
                      ? 'font-medium text-ink-700 dark:text-ink-200'
                      : 'text-ink-400 dark:text-ink-500'
                  )}
                >
                  {t(key)}
                </span>
              </span>
            </Fragment>
          )
        })}
      </ol>

      {/* Avertissement de durée : l'analyse approfondie d'une vidéo est longue, c'est normal. */}
      {preview?.isVideo && (
        <p className="text-xs leading-relaxed text-ink-400 dark:text-ink-500">
          ⏳ {t('analyzing.longNotice')}
        </p>
      )}
    </motion.div>
  )
}
