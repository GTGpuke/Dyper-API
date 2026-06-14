// Fil de commentaires d'une publication : composer (modération à l'envoi), arbre de réponses,
// suppression de ses propres commentaires et signalement. En lecture seule sur la page publique.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import {
  deleteComment,
  getPublicationComments,
  postComment,
  reportComment,
} from '../../services/api'
import type { ApiError, PublicationComment } from '../../types'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { AuthorBadge } from './AuthorBadge'

const MAX_DEPTH = 4

function Composer({
  onSubmit,
  placeholder,
  autoFocus = false,
  onCancel,
}: {
  onSubmit: (body: string) => Promise<void>
  placeholder: string
  autoFocus?: boolean
  onCancel?: () => void
}) {
  const { t } = useI18n()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focalise le champ quand un formulaire de réponse vient d'être ouvert.
  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus])

  async function submit(): Promise<void> {
    const text = body.trim()
    if (!text) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(text)
      setBody('')
      onCancel?.()
    } catch (e) {
      setError((e as ApiError).message ?? t('comment.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-y rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:shadow-focus dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50"
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" loading={busy} disabled={!body.trim()} onClick={submit}>
          {t('comment.submit')}
        </Button>
        {onCancel && (
          <Button size="sm" variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        )}
      </div>
    </div>
  )
}

function CommentNode({
  comment,
  childrenByParent,
  depth,
  interactive,
  onReply,
  onDelete,
  onReport,
}: {
  comment: PublicationComment
  childrenByParent: Map<string, PublicationComment[]>
  depth: number
  interactive: boolean
  onReply: (parentId: string, body: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onReport: (id: string) => Promise<void>
}) {
  const { t } = useI18n()
  const [replying, setReplying] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [reported, setReported] = useState(false)
  const replies = childrenByParent.get(comment.id) ?? []

  return (
    <div className={cn(depth > 0 && 'ml-3 border-l border-ink-100 pl-3 dark:border-ink-800')}>
      <div className="py-2.5">
        <AuthorBadge name={comment.author.name} avatar={comment.author.avatar} createdAt={comment.createdAt} />
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-700 dark:text-ink-200">
          {comment.body}
        </p>

        {interactive && (
          <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-400 dark:text-ink-500">
            <button type="button" onClick={() => setReplying((v) => !v)} className="hover:text-ink-700 dark:hover:text-ink-200">
              {t('comment.reply')}
            </button>
            {comment.isMine ? (
              confirmingDelete ? (
                <>
                  <button type="button" onClick={() => onDelete(comment.id)} className="text-red-600 dark:text-red-400">
                    {t('comment.deleteConfirm')}
                  </button>
                  <button type="button" onClick={() => setConfirmingDelete(false)} className="hover:text-ink-700 dark:hover:text-ink-200">
                    {t('common.cancel')}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmingDelete(true)} className="hover:text-red-600 dark:hover:text-red-400">
                  {t('comment.delete')}
                </button>
              )
            ) : reported ? (
              <span>{t('report.done')}</span>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await onReport(comment.id)
                  setReported(true)
                }}
                className="hover:text-amber-600 dark:hover:text-amber-400"
              >
                {t('report.action')}
              </button>
            )}
          </div>
        )}

        {replying && (
          <div className="mt-2">
            <Composer
              placeholder={t('comment.replyPlaceholder')}
              autoFocus
              onCancel={() => setReplying(false)}
              onSubmit={(b) => onReply(comment.id, b)}
            />
          </div>
        )}
      </div>

      {replies.map((reply) => (
        <CommentNode
          key={reply.id}
          comment={reply}
          childrenByParent={childrenByParent}
          depth={Math.min(depth + 1, MAX_DEPTH)}
          interactive={interactive}
          onReply={onReply}
          onDelete={onDelete}
          onReport={onReport}
        />
      ))}
    </div>
  )
}

export function CommentSection({
  publicationId,
  comments,
  readOnly = false,
}: {
  publicationId?: string
  comments: PublicationComment[]
  readOnly?: boolean
}) {
  const { t } = useI18n()
  const [list, setList] = useState(comments)
  useEffect(() => setList(comments), [comments])

  const interactive = !readOnly && Boolean(publicationId)

  const refresh = useCallback(async () => {
    if (publicationId) setList(await getPublicationComments(publicationId))
  }, [publicationId])

  const { roots, childrenByParent } = useMemo(() => {
    const byParent = new Map<string, PublicationComment[]>()
    const top: PublicationComment[] = []
    for (const comment of list) {
      if (comment.parentId) {
        const siblings = byParent.get(comment.parentId) ?? []
        siblings.push(comment)
        byParent.set(comment.parentId, siblings)
      } else {
        top.push(comment)
      }
    }
    return { roots: top, childrenByParent: byParent }
  }, [list])

  async function handleReply(parentId: string, body: string): Promise<void> {
    if (!publicationId) return
    await postComment(publicationId, body, parentId)
    await refresh()
  }
  async function handlePost(body: string): Promise<void> {
    if (!publicationId) return
    await postComment(publicationId, body)
    await refresh()
  }
  async function handleDelete(id: string): Promise<void> {
    await deleteComment(id)
    await refresh()
  }
  async function handleReport(id: string): Promise<void> {
    await reportComment(id, t('report.reason'))
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="eyebrow">
        {t('global.comments')} ({list.length})
      </h3>

      {interactive && <Composer placeholder={t('comment.placeholder')} onSubmit={handlePost} />}

      {list.length === 0 ? (
        <p className="text-sm text-ink-400 dark:text-ink-500">{t('comment.empty')}</p>
      ) : (
        <div className="flex flex-col divide-y divide-ink-100 dark:divide-ink-800">
          {roots.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              childrenByParent={childrenByParent}
              depth={0}
              interactive={interactive}
              onReply={handleReply}
              onDelete={handleDelete}
              onReport={handleReport}
            />
          ))}
        </div>
      )}
    </div>
  )
}
