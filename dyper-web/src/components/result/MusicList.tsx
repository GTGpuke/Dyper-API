// Liste des bandes-son identifiées par fingerprinting (AudD) : une ligne par titre,
// cliquable vers la page d'écoute multi-plateformes lorsqu'un lien est disponible.
import { useI18n } from '../../contexts/I18nContext'
import type { MusicInfo } from '../../types'

const NOTE_ICON = (
  <svg className="h-4 w-4 shrink-0 text-brand-500 dark:text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
)

const LINK_ICON = (
  <svg className="h-3.5 w-3.5 shrink-0 text-ink-400 transition-colors group-hover:text-brand-500 dark:group-hover:text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <path d="M15 3h6v6M10 14L21 3" />
  </svg>
)

export function MusicList({ music }: { music: MusicInfo[] }) {
  const { t } = useI18n()
  if (music.length === 0) return null

  return (
    <ul className="flex flex-col gap-1.5">
      {music.map((track, index) => {
        const content = (
          <>
            {NOTE_ICON}
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium text-ink-800 dark:text-ink-100">
                {track.artist} — {track.title}
              </span>
              {track.album && <span className="text-ink-400 dark:text-ink-500"> · {track.album}</span>}
            </span>
            {track.link && LINK_ICON}
          </>
        )
        return (
          <li key={`${track.artist}-${track.title}-${index}`}>
            {track.link ? (
              <a
                href={track.link}
                target="_blank"
                rel="noopener noreferrer"
                title={t('music.listen')}
                className="group flex items-center gap-2.5 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-sm transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-ink-700 dark:bg-ink-800/60 dark:hover:border-brand-500/40 dark:hover:bg-brand-600/10"
              >
                {content}
              </a>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800/60">
                {content}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
