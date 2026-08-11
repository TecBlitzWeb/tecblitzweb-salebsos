import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Input'
import { Skeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { EmptyState } from '../../components/shared/EmptyState'
import { ErrorState } from '../../components/shared/ErrorState'
import { useAuth } from '../../auth/useAuth'
import { formatDetailDate, formatRelativeDate } from '../../lib/format'
import { displayRepName } from '../../lib/repKey'
import { useSalesUsers } from '../../api/users'
import { describeReadError, describeWriteError } from '../../api/writeError'
import {
  useAddAnnouncement,
  useAnnouncements,
  useDeleteAnnouncement,
} from '../../api/announcements'

/**
 * Everyone reads; CEO and Co-CEO write and delete.
 *
 * There is no title column on `announcements` — the body is the whole post, so
 * this renders one block of text per item and never a heading.
 */
export function AnnouncementsPage() {
  const { role, user } = useAuth()
  const { data, isLoading, error, refetch } = useAnnouncements()
  const salesUsers = useSalesUsers()
  const add = useAddAnnouncement()
  const remove = useDeleteAnnouncement()
  const { showToast } = useToast()
  const [body, setBody] = useState('')
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  const canAnnounce = role === 'CEO' || role === 'Co-CEO'

  /*
    `author_id` is an auth uuid, so the roster is keyed by `auth_user_id` here —
    not by `sales_users.id`, which is the bigint the rest of the app joins on.
  */
  const authorNames = useMemo(() => {
    const byAuthId = new Map<string, string>()
    for (const u of salesUsers.data ?? []) {
      if (!u.auth_user_id) continue
      byAuthId.set(u.auth_user_id, u.name?.trim() || displayRepName(u.username) || 'Unknown')
    }
    return byAuthId
  }, [salesUsers.data])

  async function post() {
    const text = body.trim()
    // The INSERT policy is `author_id = auth.uid()`, so with no session there is
    // nothing valid to write.
    if (!text || !user?.id) return
    try {
      await add.mutateAsync({ body: text, authorId: user.id })
      setBody('')
      showToast({ message: 'Announcement posted', tone: 'success' })
    } catch (err) {
      showToast({ message: describeWriteError(err, 'post this announcement'), tone: 'error' })
    }
  }

  async function destroy(id: number) {
    try {
      await remove.mutateAsync({ id })
      setConfirmingId(null)
      showToast({ message: 'Announcement deleted', tone: 'success' })
    } catch (err) {
      showToast({ message: describeWriteError(err, 'delete this announcement'), tone: 'error' })
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {canAnnounce && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-text">Post an announcement</h2>
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Everyone on the team sees this."
            aria-label="Announcement body"
          />
          <div className="flex justify-end">
            <Button
              size="default"
              variant="primary"
              loading={add.isPending}
              disabled={!body.trim() || !user?.id}
              onClick={() => void post()}
            >
              Post
            </Button>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg text-text">All announcements</h2>

        {isLoading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <ErrorState
            {...describeReadError(error, 'announcements')}
            onRetry={() => void refetch()}
          />
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            message={
              canAnnounce
                ? 'No announcements yet. Post the first one above.'
                : 'No announcements yet. Team-wide news from the CEO shows up here.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {(data ?? []).map((item) => {
              const author = item.author_id ? authorNames.get(item.author_id) : undefined
              const confirming = confirmingId === item.id

              return (
                <li key={item.id} className="rounded-md border border-border bg-surface p-3.5">
                  <p className="whitespace-pre-wrap text-base text-text">{item.body}</p>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    {/*
                      An unresolved author reads as "Unknown", never a fabricated
                      name: `author_id` points at an auth user who may no longer
                      have a `sales_users` row.
                    */}
                    <p className="text-2xs text-text-subtle">
                      {author ?? 'Unknown'}
                      {item.created_at && (
                        <span title={formatDetailDate(new Date(item.created_at))}>
                          {' · '}
                          {formatRelativeDate(new Date(item.created_at))}
                        </span>
                      )}
                    </p>

                    {canAnnounce && !confirming && (
                      <button
                        type="button"
                        aria-label="Delete announcement"
                        onClick={() => setConfirmingId(item.id)}
                        className="focus-ring shrink-0 rounded-sm p-1 text-text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-danger motion-reduce:transition-none"
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>

                  {confirming && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-sm border border-danger/30 bg-danger/10 p-2">
                      <p className="text-xs text-text">
                        Delete this announcement? It goes for everyone.
                      </p>
                      <div className="ml-auto flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          loading={remove.isPending}
                          onClick={() => void destroy(item.id)}
                        >
                          Delete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={remove.isPending}
                          onClick={() => setConfirmingId(null)}
                        >
                          Keep
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
