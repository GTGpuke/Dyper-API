// Détail in-app d'une publication : vue complète, vote, partage, gestion (dépublier) et commentaires.
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AuthorBadge } from '../components/global/AuthorBadge'
import { CommentSection } from '../components/global/CommentSection'
import { PublicationView } from '../components/global/PublicationView'
import { ShareButton } from '../components/global/ShareButton'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '../components/ui/Button'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Skeleton } from '../components/ui/Skeleton'
import { VoteControl } from '../components/ui/VoteControl'
import { useI18n } from '../contexts/I18nContext'
import {
  deletePublication,
  getPublication,
  getPublicationComments,
  votePublication,
} from '../services/api'
import type { ApiError, Publication, PublicationComment, PublicVote } from '../types'

export function PublicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [pub, setPub] = useState<Publication | null>(null)
  const [comments, setComments] = useState<PublicationComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [publication, list] = await Promise.all([
        getPublication(id),
        getPublicationComments(id),
      ])
      setPub(publication)
      setComments(list)
    } catch (e) {
      setError(e as ApiError)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function handleVote(value: PublicVote): Promise<void> {
    if (!pub) return
    const previous = pub
    setPub({ ...pub, myVote: value, score: pub.score + (value - pub.myVote) })
    try {
      const result = await votePublication(pub.id, value)
      setPub((current) =>
        current
          ? {
              ...current,
              score: result.score,
              upvotes: result.upvotes,
              downvotes: result.downvotes,
              myVote: result.myVote,
            }
          : current
      )
    } catch {
      setPub(previous)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!pub) return
    await deletePublication(pub.id)
    navigate('/global')
  }

  return (
    <PageContainer>
      <Link
        to="/global"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200"
      >
        ← {t('global.back')}
      </Link>

      {error && <ErrorBanner error={error} />}

      {loading && (
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96" />
        </div>
      )}

      {!loading && pub && (
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AuthorBadge name={pub.author.name} avatar={pub.author.avatar} createdAt={pub.createdAt} />
            <div className="flex items-center gap-2">
              <ShareButton slug={pub.slug} />
              {pub.isMine &&
                (confirmingDelete ? (
                  <span className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setConfirmingDelete(false)}>
                      {t('common.cancel')}
                    </Button>
                    <Button size="sm" onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                      {t('global.unpublish')}
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setConfirmingDelete(true)}>
                    {t('global.unpublish')}
                  </Button>
                ))}
            </div>
          </div>

          <div className="surface p-6">
            <PublicationView publication={pub} />
          </div>

          <div className="surface flex items-center gap-3 p-4">
            <VoteControl score={pub.score} myVote={pub.myVote} onChange={handleVote} />
            <span className="text-sm text-ink-500 dark:text-ink-400">{t('global.scoreLabel')}</span>
          </div>

          <div className="surface p-6">
            <CommentSection publicationId={pub.id} comments={comments} />
          </div>
        </div>
      )}
    </PageContainer>
  )
}
