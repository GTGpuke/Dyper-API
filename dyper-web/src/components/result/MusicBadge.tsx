// Badge de la bande-son identifiée par fingerprinting (artiste — titre, album en infobulle).
import { useI18n } from '../../contexts/I18nContext'
import type { MusicInfo } from '../../types'

export function MusicBadge({ music }: { music: MusicInfo }) {
  const { t } = useI18n()
  const tooltip = music.album
    ? `${t('music.title')} : ${music.artist} — ${music.title} (${music.album})`
    : `${t('music.title')} : ${music.artist} — ${music.title}`

  return (
    <span
      title={tooltip}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-600/15 dark:text-brand-300"
    >
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      <span className="truncate">
        {music.artist} — {music.title}
      </span>
    </span>
  )
}
