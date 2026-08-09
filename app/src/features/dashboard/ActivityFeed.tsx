import { EmptyState } from '../../components/shared/EmptyState'
import { ErrorState } from '../../components/shared/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { StatusChip } from '../../components/shared/StatusChip'
import { timeOf } from '../../api/calls'
import { formatRelativeDate } from '../../lib/format'
import { displayRepName } from '../../lib/repKey'
import { SupabaseError } from '../../lib/queryClient'
import { toOutcome } from '../prospects/ProspectRow'
import { useActivityFeed } from './useActivityFeed'

function readError(error: unknown): { message: string; status: number } {
  if (error instanceof SupabaseError) {
    if (error.status === 401) return { message: 'Your session expired. Sign in again.', status: 401 }
    if (error.status === 403) {
      return { message: `You don't have permission to read activity.`, status: 403 }
    }
    return { message: `Couldn't load activity. Check your connection.`, status: error.status }
  }
  return { message: `Couldn't load activity. Check your connection.`, status: 0 }
}

/**
 * SPEC §5.1's "Activity feed: last 15 calls in visible scope" — not mentioned
 * in DESIGN_RULES §7's Today section, so its visual treatment is not
 * prescribed there. Built here as a plain reverse-chronological list,
 * matching the density and chip language already used on Follow-ups and My
 * Calls rather than inventing a new pattern.
 */
export function ActivityFeed() {
  const { items, isLoading, error, refetch } = useActivityFeed()

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg text-text">Activity</h2>

      {error ? (
        <ErrorState {...readError(error)} onRetry={refetch} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState message="No calls logged yet." />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
          {items.map((call) => (
            <li key={call.id} className="flex min-w-0 items-center gap-3 px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-text">
                {call.prospect || 'Unknown business'}
              </span>
              <span className="shrink-0 text-xs text-text-muted">{displayRepName(call.rep)}</span>
              <StatusChip outcome={toOutcome(call.outcome)} />
              <span className="shrink-0 text-2xs tabular-nums text-text-subtle">
                {formatRelativeDate(new Date(timeOf(call.createdat)))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
