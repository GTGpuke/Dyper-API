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
  /** Première image de la vidéo, servie d'affiche le temps que la lecture démarre. */
  thumbnailUrl?: string | null
}

interface Props {
  preview: AnalyzingPreview | null
  /** Progression réelle du téléversement (0–100), null si pas de fichier. */
  uploadPct: number | null
  /**
   * Instant de départ de l'analyse (epoch ms), connu côté serveur. Fourni au reload / retour sur la
   * conversation pour que la barre et l'ETA restent calés sur la durée réelle (et non sur le montage
   * du composant). Null pour un envoi frais (l'horloge démarre alors à la fin du téléversement).
   */
  startedAt?: number | null
  /** Interrompt l'analyse en cours (bouton Stop). Masqué si absent. */
  onCancel?: () => void
  /** L'analyse est EN FILE d'attente (pas encore en traitement) : afficher l'attente, pas la progression. */
  queued?: boolean
  /**
   * Délai estimé (s) avant le démarrage de l'analyse quand elle est en file (file d'attente de calcul).
   * Null si inconnu / service non saturé.
   */
  queueEtaSeconds?: number | null
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

// Messages de réassurance en rotation (image et vidéo) : prévention des délais + excuses si le
// service est chargé. En vidéo, l'avertissement de durée s'y ajoute.
const NOTICES_COMMON = ['analyzing.notice.scan', 'analyzing.notice.busy', 'analyzing.notice.quality']

// Sablier SVG animé : la silhouette se retourne en boucle pendant que le « sable » s'écoule,
// en remplacement de l'émoji ⏳ pour un rendu net et cohérent avec le thème.
function Hourglass() {
  return (
    <motion.svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-ink-400 dark:text-ink-500"
      style={{ transformOrigin: '50% 50%' }}
      animate={{ rotate: [0, 0, 180, 180] }}
      transition={{ duration: 2.4, times: [0, 0.45, 0.6, 1], repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Cadre du sablier. */}
      <path
        d="M6 3h12M6 21h12M7 3v3.5a2 2 0 0 0 .6 1.4L12 12l4.4-4.1a2 2 0 0 0 .6-1.4V3M7 21v-3.5a2 2 0 0 1 .6-1.4L12 12l4.4 4.1a2 2 0 0 1 .6 1.4V21"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Filet de sable qui s'écoule. */}
      <motion.line
        x1="12"
        y1="11"
        x2="12"
        y2="13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 2.4, times: [0, 0.1, 0.4, 0.5], repeat: Infinity, ease: 'linear' }}
      />
    </motion.svg>
  )
}

// Estimation de la durée de traitement (secondes) selon le média.
function estimateProcessing(preview: AnalyzingPreview | null): number {
  if (!preview?.isVideo) return 8
  if (preview.durationS) return 25 + preview.durationS * 0.5
  // Lien de plateforme : durée inconnue (téléchargement + analyse).
  return 150
}

export function AnalyzingIndicator({
  preview,
  uploadPct,
  startedAt,
  onCancel,
  queued,
  queueEtaSeconds,
}: Props) {
  const { t } = useI18n()
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)
  // En file d'attente : le traitement n'a PAS commencé → on n'affiche aucune progression, juste
  // l'attente (et le délai estimé). La progression reprend de zéro dès que le traitement démarre.
  const waiting = queued === true
  // Au reload / retour sur la conversation, l'analyse a déjà démarré côté serveur (pas de
  // téléversement à attendre) : on considère le transfert terminé.
  const uploadDone = startedAt != null || uploadPct === null || uploadPct >= 100

  // Horloge du temps écoulé : gelée tant qu'on est en file (le traitement n'a pas commencé) ; sinon
  // calée sur l'instant serveur quand il est connu (stable au reload), à défaut sur le démarrage du
  // traitement. Repartir de zéro à la sortie de la file évite que la barre saute en avant.
  useEffect(() => {
    if (waiting) {
      setElapsed(0)
      return
    }
    if (startedAt == null && !uploadDone) return
    const base = startedAt ?? (startRef.current ?? Date.now())
    if (startedAt == null) startRef.current = base
    const tick = (): void => setElapsed(Math.max(0, (Date.now() - base) / 1000))
    tick()
    const timer = setInterval(tick, 500)
    return () => clearInterval(timer)
  }, [waiting, uploadDone, startedAt])

  const estimate = estimateProcessing(preview)
  const pct = waiting
    ? 6 // Remplissage symbolique « en attente » (la barre n'avance pas tant que rien n'est traité).
    : uploadDone
      ? Math.min(95, UPLOAD_SHARE + (95 - UPLOAD_SHARE) * Math.min(1, elapsed / estimate))
      : ((uploadPct ?? 0) / 100) * UPLOAD_SHARE

  // Rotation des phrases (~3,5 s) ; en file → phrase d'attente ; sinon téléversement prioritaire.
  const phrases = preview?.isVideo ? PHRASES_VIDEO : PHRASES_IMAGE
  const phraseKey = waiting
    ? 'analyzing.queued'
    : uploadDone
      ? phrases[Math.floor(elapsed / 3.5) % phrases.length]
      : 'analyzing.upload'

  // Étape active de la frise, calée sur la fraction de progression post-téléversement (aucune en file).
  const steps = preview?.isVideo ? STEPS_VIDEO : STEPS_IMAGE
  const fraction = Math.max(0, pct - UPLOAD_SHARE) / (95 - UPLOAD_SHARE)
  const activeStep =
    !waiting && uploadDone ? Math.min(steps.length - 1, Math.floor(fraction * steps.length)) : -1

  // Temps estimé restant (décompte doux) + message de réassurance en rotation (~5 s).
  const remaining = Math.max(0, estimate - elapsed)
  const notices = preview?.isVideo ? [...NOTICES_COMMON, 'analyzing.longNotice'] : NOTICES_COMMON
  // En file d'attente : on annonce le délai estimé avant le démarrage (sinon message générique).
  const hasEta = queueEtaSeconds != null && queueEtaSeconds > 0
  const noticeKey = waiting ? 'analyzing.queued' : notices[Math.floor(elapsed / 5) % notices.length]
  const noticeText = waiting
    ? hasEta
      ? t('analyzing.queueWait', { time: formatTimecode(queueEtaSeconds) })
      : t('analyzing.queueBusy')
    : t(noticeKey)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface flex max-w-xl flex-col gap-4 p-4"
    >
      <div className="flex items-center gap-4">
        {/* Aperçu réel du média, balayé par le réticule de scan. */}
        <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl bg-ink-950 ring-1 ring-violet-500/30">
          {preview?.url ? (
            preview.isVideo ? (
              <video
                src={preview.url}
                poster={preview.thumbnailUrl ?? undefined}
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
          ) : preview?.thumbnailUrl ? (
            // Pas de lecture live (reload, autre analyse, lien plateforme) → vignette statique persistée.
            <img src={preview.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-90" />
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

        {/* Bouton Stop : interrompt l'analyse et libère le moteur côté serveur. */}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('analyzing.stop')}
            title={t('analyzing.stop')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500 dark:text-ink-500"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        )}
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

      {/* Réassurance en rotation + temps estimé restant (image et vidéo). */}
      {uploadDone && (
        <div className="flex items-center justify-between gap-3 text-xs text-ink-400 dark:text-ink-500">
          <div className="flex h-4 min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            <Hourglass />
            <AnimatePresence mode="wait">
              <motion.p
                key={noticeKey}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="min-w-0 flex-1 truncate"
              >
                {noticeText}
              </motion.p>
            </AnimatePresence>
          </div>
          {/* Le décompte « restant » n'a de sens qu'en cours de traitement (pas en file d'attente). */}
          {!waiting && (
            <span className="shrink-0 font-mono tabular-nums">
              {remaining > 1
                ? t('analyzing.eta', { time: formatTimecode(remaining) })
                : t('analyzing.almostDone')}
            </span>
          )}
        </div>
      )}
    </motion.div>
  )
}
