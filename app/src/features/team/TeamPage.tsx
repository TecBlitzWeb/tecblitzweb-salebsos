import { useMemo } from 'react'
import clsx from 'clsx'
import { ErrorState } from '../../components/shared/ErrorState'
import { EmptyState } from '../../components/shared/EmptyState'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { SupabaseError } from '../../lib/queryClient'
import { resolveRange } from '../../lib/dateRange'
import { useSalesUsers, salesUserKey, type SalesUser } from '../../api/users'
import { usePerformance } from '../performance/usePerformance'

function readError(error: unknown): { message: string; status: number } {
  if (error instanceof SupabaseError) {
    if (error.status === 401) return { message: 'Your session expired. Sign in again.', status: 401 }
    if (error.status === 403) {
      return { message: `You don't have permission to read the team.`, status: 403 }
    }
    return { message: `Couldn't load the team. Check your connection.`, status: error.status }
  }
  return { message: `Couldn't load the team. Check your connection.`, status: 0 }
}

/** A value the database never got. Rendered as absent, never as an empty cell. */
function Missing({ label }: { label: string }) {
  return (
    <span className="text-text-subtle" title={`No ${label} on this row`}>
      —
    </span>
  )
}

interface TeamRow {
  user: SalesUser
  key: string
  calls: number
  /** True when the row has no `auth_user_id`, so this person cannot sign in. */
  noLogin: boolean
}

function MemberRow({ row }: { row: TeamRow }) {
  const { user } = row
  // Greyed, never removed — a member with no calls is a finding, not an absence.
  const silent = row.calls === 0

  return (
    <tr className={clsx('border-b border-border last:border-b-0', silent && 'text-text-subtle')}>
      <td className="px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={clsx('truncate', silent ? 'text-text-subtle' : 'text-text')}>
            {user.name?.trim() || <Missing label="name" />}
          </span>
          {row.noLogin && (
            <span
              title="No auth_user_id — this person has a roster row but cannot sign in"
              className="shrink-0 rounded-sm bg-warning/15 px-1.5 py-0.5 text-2xs text-warning"
            >
              No login
            </span>
          )}
        </div>
      </td>
      {/*
        username and role are text, not controls. canonical_rep() derives every
        rep's identity from username, and RLS matches role as an exact string —
        an edit here would silently re-key a call history or revoke access.
      */}
      <td className="px-3 py-2 font-mono text-xs text-text-muted">
        {user.username?.trim() || <Missing label="username" />}
      </td>
      <td className="px-3 py-2">
        <span className="truncate text-text-muted">
          {user.email?.trim() || <Missing label="email" />}
        </span>
      </td>
      <td className="px-3 py-2">
        <span className="shrink-0 rounded-sm bg-text-subtle/12 px-1.5 py-0.5 text-2xs text-text-muted">
          {user.role?.trim() || 'No role'}
        </span>
      </td>
      <td className="px-3 py-2 font-mono text-xs text-text-muted">
        {row.key || <Missing label="canonical key" />}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{row.calls.toLocaleString('en-US')}</td>
    </tr>
  )
}

/**
 * The roster, CEO-only (enforced by `RequireRole` from `navConfig`).
 *
 * Call counts come from `usePerformance` over the all-time range rather than a
 * second counter, so this page and Performance can never disagree about how
 * many calls someone made. The join is on the canonical key, never on a display
 * spelling.
 *
 * Every column is read-only. `sales_users` has no deactivation column, and
 * creating a login needs the auth admin API, which the browser's key cannot
 * reach — so there is no control here that RLS or a missing column would
 * reject. Nothing is rendered that would fail when clicked.
 */
export function TeamPage() {
  const users = useSalesUsers()

  // All-time, unbounded: the roster is not a period report, and a member with
  // no calls this month is not the same fact as a member with no calls ever.
  const allTime = useMemo(() => resolveRange('all'), [])
  const performance = usePerformance(allTime)

  const { rows, offRoster } = useMemo(() => {
    const callsByKey = new Map(performance.reps.map((rep) => [rep.key, rep]))

    const rows: TeamRow[] = (users.data ?? [])
      .map((user) => {
        const key = salesUserKey(user)
        return {
          user,
          key,
          calls: callsByKey.get(key)?.calls ?? 0,
          noLogin: !user.auth_user_id,
        }
      })
      .sort((a, b) => {
        if (a.calls !== b.calls) return b.calls - a.calls
        return (a.user.name ?? '').localeCompare(b.user.name ?? '')
      })

    // Keys that show up in the call data but match no roster row. Surfacing
    // these is the whole point of a roster page — silently dropping them is how
    // v1 lost 332 calls.
    const rosterKeys = new Set(rows.map((r) => r.key))
    const offRoster = performance.reps.filter(
      (rep) => rep.calls > 0 && !rosterKeys.has(rep.key)
    )

    return { rows, offRoster }
  }, [users.data, performance.reps])

  const error = users.error ?? performance.error
  if (error) {
    return (
      <ErrorState
        {...readError(error)}
        onRetry={() => {
          void users.refetch()
          performance.refetch()
        }}
      />
    )
  }

  const isLoading = users.isLoading || performance.isLoading

  return (
    <div className="flex flex-col gap-6">
      {offRoster.length > 0 && (
        <p
          role="alert"
          className="rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          {offRoster.length} rep {offRoster.length === 1 ? 'key logs' : 'keys log'} calls but
          {offRoster.length === 1 ? ' has' : ' have'} no row in sales_users:{' '}
          {offRoster.map((rep, i) => (
            <span key={rep.key}>
              {i > 0 && ', '}
              <span className="font-mono">{rep.key}</span> ({rep.calls.toLocaleString('en-US')})
            </span>
          ))}
          . Their calls count on Performance but they cannot sign in or be assigned work.
        </p>
      )}

      {isLoading ? (
        <TableSkeleton rows={9} columns={6} />
      ) : rows.length === 0 ? (
        <EmptyState message="No team members visible. Either sales_users is empty or RLS is hiding every row from this account." />
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-text">
            Roster{' '}
            <span className="text-sm tabular-nums text-text-muted">({rows.length})</span>
          </h2>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-2xs uppercase tracking-wide text-text-muted">
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Username</th>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">Role</th>
                  <th className="px-3 py-2 text-left font-medium">Canonical key</th>
                  <th className="px-3 py-2 text-right font-medium">Calls</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <MemberRow key={row.user.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-2xs text-text-subtle">
            Read-only. Username and role are shown as text on purpose: canonical_rep() derives a
            rep&apos;s identity from their username, and RLS matches role as an exact string, so
            editing either here would silently re-key a call history or revoke someone&apos;s
            access. Calls are all-time and come from the same computation as Performance. Roster
            changes are made in Supabase.
          </p>
        </section>
      )}
    </div>
  )
}
