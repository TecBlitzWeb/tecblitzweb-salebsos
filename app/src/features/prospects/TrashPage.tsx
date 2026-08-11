import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/shared/EmptyState'
import { ErrorState } from '../../components/shared/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { formatDetailDate, formatRelativeDate } from '../../lib/format'
import { displayRepName } from '../../lib/repKey'
import { describeReadError, describeWriteError } from '../../api/writeError'
import {
  useDeletedProspects,
  usePurgeProspect,
  useRestoreProspect,
} from '../../api/prospects'

/**
 * Deleted prospects, newest deletion first. CEO/Co-CEO only — the route's
 * audience is declared in navConfig and enforced by `RequireRole`, so there is
 * no role check in here.
 *
 * Restore is one tap. Permanent delete is two, and says out loud what it cannot
 * undo: `calls` joins prospects by name text with no foreign key, so a purged
 * business keeps its call history and that history stops belonging to anything.
 */
export function TrashPage() {
  const { data, isLoading, error, refetch } = useDeletedProspects()
  const restore = useRestoreProspect()
  const purge = usePurgeProspect()
  const { showToast } = useToast()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full max-w-2xl" />
        <Skeleton className="h-16 w-full max-w-2xl" />
      </div>
    )
  }

  if (error) {
    return <ErrorState {...describeReadError(error, 'the trash')} onRetry={() => void refetch()} />
  }

  const rows = data ?? []

  async function onRestore(id: string, name: string) {
    try {
      await restore.mutateAsync({ id })
      showToast({ message: `${name} restored`, tone: 'success' })
    } catch (err) {
      showToast({ message: describeWriteError(err, 'restore this prospect'), tone: 'error' })
    }
  }

  async function onPurge(id: string, name: string) {
    try {
      await purge.mutateAsync({ id })
      setConfirmingId(null)
      showToast({ message: `${name} deleted permanently`, tone: 'success' })
    } catch (err) {
      showToast({ message: describeWriteError(err, 'delete this prospect'), tone: 'error' })
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-text-muted">
        Deleted prospects are hidden from every list, count and search, and are not
        assigned to anyone. Restoring one puts it back exactly as it was.
      </p>

      {rows.length === 0 ? (
        <EmptyState
          message="Nothing in the trash."
          action={
            <Link
              to="/prospects"
              className="focus-ring rounded-sm text-sm text-brand hover:text-brand-hover"
            >
              Go to Prospects
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const name = row.name?.trim() || 'Unnamed'
            const confirming = confirmingId === row.id
            const busy = restore.isPending || purge.isPending

            return (
              <li
                key={row.id}
                className="rounded-md border border-border bg-surface p-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{name}</p>
                    {/* §11: relative under 7 days, absolute beyond — with the exact
                        date in the title so "3 days ago" is still auditable. */}
                    <p className="mt-0.5 text-2xs text-text-subtle">
                      Deleted{' '}
                      {row.deleted_at ? (
                        <span title={formatDetailDate(new Date(row.deleted_at))}>
                          {formatRelativeDate(new Date(row.deleted_at)).toLowerCase()}
                        </span>
                      ) : (
                        'at an unknown time'
                      )}
                      {row.assignedto && ` · was ${displayRepName(row.assignedto)}'s`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void onRestore(row.id, name)}
                    >
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => setConfirmingId(confirming ? null : row.id)}
                    >
                      Delete permanently
                    </Button>
                  </div>
                </div>

                {confirming && (
                  <div className="mt-3 rounded-sm border border-danger/30 bg-danger/10 p-3">
                    <p className="text-sm text-text">
                      Permanently delete <span className="font-medium">{name}</span>? This cannot
                      be undone.
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      The call history for this business is <strong>not</strong> deleted. Calls are
                      matched to prospects by business name, so those calls will become unlinked —
                      they keep counting on Performance and My Calls but will no longer belong to
                      any prospect.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        loading={purge.isPending}
                        onClick={() => void onPurge(row.id, name)}
                      >
                        Delete permanently
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={purge.isPending}
                        onClick={() => setConfirmingId(null)}
                      >
                        Keep it
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
