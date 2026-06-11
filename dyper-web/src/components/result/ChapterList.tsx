// Chapitres d'une analyse vidéo : ce qu'on voit (description + éléments) et ce qu'on entend
// (transcription) par intervalle de temps, avec horodatage cliquable (saut du lecteur).
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import type { Chapter } from '../../types'
import { formatTimecode } from '../../utils/formatters'

interface Props {
  chapters: Chapter[]
  /** Saute le lecteur vidéo au temps donné (les horodatages deviennent cliquables). */
  onSeek?: (time: number) => void
}

export function ChapterList({ chapters, onSeek }: Props) {
  const { t } = useI18n()

  return (
    <ol className="flex flex-col gap-2.5">
      {chapters.map((chapter) => {
        const timecode = `${formatTimecode(chapter.tStart)} – ${formatTimecode(chapter.tEnd)}`
        return (
          <li
            key={chapter.tStart}
            className="rounded-xl border border-ink-100 bg-ink-50/60 p-3 dark:border-ink-800 dark:bg-ink-800/40"
          >
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {onSeek ? (
                <button
                  type="button"
                  onClick={() => onSeek(chapter.tStart)}
                  title={t('chapters.seek')}
                  className="shrink-0 rounded-md bg-brand-600/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-600 hover:text-white dark:bg-brand-400/15 dark:text-brand-300 dark:hover:bg-brand-500 dark:hover:text-white"
                >
                  {timecode}
                </button>
              ) : (
                <span className="shrink-0 font-mono text-xs font-semibold text-ink-500 dark:text-ink-400">
                  {timecode}
                </span>
              )}
              <p
                className={cn(
                  'min-w-0 flex-1 text-sm leading-relaxed text-ink-700 dark:text-ink-200',
                  !chapter.description && 'italic text-ink-400 dark:text-ink-500'
                )}
              >
                {chapter.description ?? t('chapters.noDescription')}
              </p>
            </div>

            {chapter.transcript && (
              <p className="mt-1.5 border-l-2 border-brand-300 pl-2.5 text-xs italic leading-relaxed text-ink-500 dark:border-brand-500/50 dark:text-ink-400">
                « {chapter.transcript} »
              </p>
            )}

            {chapter.elements.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {chapter.elements.map((element) => (
                  <span
                    key={element}
                    className="rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[10px] text-ink-500 dark:bg-ink-700/60 dark:text-ink-300"
                  >
                    {element}
                  </span>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
