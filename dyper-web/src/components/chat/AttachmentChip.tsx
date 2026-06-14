// Pastille de pièce jointe en attente dans le composer (aperçu image / icône vidéo / URL).
import { useI18n } from '../../contexts/I18nContext'
import type { PendingAttachment } from '../../types'

export function AttachmentChip({
  attachment,
  checking,
  onRemove,
}: {
  attachment: PendingAttachment
  checking: boolean
  onRemove: () => void
}) {
  const { t } = useI18n()
  const label =
    attachment.kind === 'file' ? attachment.file.name : attachment.url
  // Vignette : première image (fichier vidéo), aperçu image, ou miniature de plateforme (URL).
  const thumbnail = attachment.thumbnailUrl ?? null

  return (
    <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-2 py-1.5 dark:border-ink-700 dark:bg-ink-800">
      {thumbnail ? (
        <img src={thumbnail} alt="" className="h-8 w-8 rounded-lg object-cover" />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-200 text-ink-500 dark:bg-ink-700 dark:text-ink-300">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {attachment.kind === 'file' && attachment.isVideo ? (
              <path d="M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </span>
      )}
      <span className="max-w-48 truncate text-xs text-ink-600 dark:text-ink-300">
        {checking ? t('input.checkingVideo') : label}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-ink-200 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-200"
        aria-label={t('chat.attach.remove')}
        title={t('chat.attach.remove')}
      >
        ✕
      </button>
    </div>
  )
}
