import { useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useProspectCounts } from '../../api/counts'
import { useProspectViews } from '../prospects/useProspectList'
import { useSalesUsers } from '../../api/users'
import { useBulkReassign } from '../../api/prospects'
import { useToast } from '../../components/ui/Toast'
import { describeWriteError } from '../../api/writeError'
import { displayRepName, canonicalRepKey } from '../../lib/repKey'
import { useAuth } from '../../auth/useAuth'

interface PendingReassign {
  key: string
  spelling: string
  targetUsername: string
  ids: string[]
}

/**
 * CEO/Co-CEO-only block (SPEC §5.1): reps with untouched assigned prospects,
 * worst first, each reassignable inline. Counts come straight from the
 * canonical counts hook's `byAssigneeNeverCalled` — never a parallel tally
 * (SPEC §0.13). Reassignment resolves the exact prospect ids from the
 * canonical prospect views at the moment the rep is picked, so it always
 * matches every spelling variant of that rep's name, not just one.
 *
 * Not rendered at all for a Sales viewer — TodayPage gates this component
 * behind `{isManager && <Coverage />}`, so none of these hooks (including the
 * two full-table reads) execute for that role; it is not merely hidden.
 */
export function Coverage() {
  const { repKey: myKey } = useAuth()
  const { counts, isLoading } = useProspectCounts(myKey)
  const { views } = useProspectViews()
  const { data: salesUsers } = useSalesUsers()
  const bulkReassign = useBulkReassign()
  const { showToast } = useToast()
  const [pending, setPending] = useState<PendingReassign | null>(null)

  const rows = useMemo(
    () =>
      [...counts.byAssigneeNeverCalled.values()]
        .filter((t) => t.count > 0)
        .sort((a, b) => b.count - a.count),
    [counts.byAssigneeNeverCalled]
  )

  const reps = useMemo(
    () => (salesUsers ?? []).filter((u) => (u.role ?? '').trim() === 'Sales'),
    [salesUsers]
  )

  function stage(key: string, spelling: string, targetUsername: string) {
    const ids = views
      .filter(
        (v) => canonicalRepKey(v.row.assignedto).trim() === key && v.daysSinceLastCall === null
      )
      .map((v) => v.row.id)
    if (ids.length === 0) return
    setPending({ key, spelling, targetUsername, ids })
  }

  async function confirmReassign() {
    if (!pending) return
    const { spelling, targetUsername, ids } = pending
    // The written value is always the clean display form, never the raw
    // sales_users.username spelling (which itself may carry trailing digits).
    const assignedto = displayRepName(targetUsername)
    try {
      await bulkReassign.mutateAsync({ ids, assignedto })
      showToast({
        message: `Reassigned ${ids.length} from ${displayRepName(spelling)} to ${assignedto}`,
        tone: 'success',
      })
    } catch (error) {
      showToast({ message: describeWriteError(error, 'reassign these prospects'), tone: 'error' })
    } finally {
      setPending(null)
    }
  }

  if (isLoading || rows.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg text-text">Coverage</h2>
      <div className="flex flex-col gap-2">
        {rows.map((tally) => {
          const isPendingRow = pending?.key === tally.key
          return (
            <div
              key={tally.key}
              className="flex flex-col gap-2 rounded-md border border-border bg-surface px-3.5 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-text">
                  {displayRepName(tally.spelling)}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-text-muted">
                  {tally.count} untouched
                </span>
                <select
                  aria-label={`Reassign ${displayRepName(tally.spelling)}'s untouched prospects`}
                  disabled={bulkReassign.isPending || isPendingRow}
                  defaultValue=""
                  onChange={(e) => {
                    const target = e.target.value
                    e.target.value = ''
                    if (target) stage(tally.key, tally.spelling, target)
                  }}
                  className="focus-ring h-8 shrink-0 rounded-sm border border-border-strong bg-surface px-2 text-xs text-text disabled:opacity-50"
                >
                  <option value="" disabled>
                    Reassign to…
                  </option>
                  {reps
                    .filter((u) => canonicalRepKey(u.username).trim() !== tally.key)
                    .map((u) => (
                      <option key={u.id} value={u.username ?? ''}>
                        {u.name || u.username}
                      </option>
                    ))}
                </select>
              </div>

              {/* Confirmation states the exact count before anything is written. */}
              {isPendingRow && (
                <div className="flex flex-wrap items-center gap-2 rounded-sm border border-brand/30 bg-brand-ghost px-2.5 py-2 text-xs text-text">
                  <span>
                    Reassign <strong className="tabular-nums">{pending.ids.length}</strong>{' '}
                    untouched {pending.ids.length === 1 ? 'prospect' : 'prospects'} from{' '}
                    {displayRepName(pending.spelling)} to{' '}
                    {displayRepName(pending.targetUsername)}?
                  </span>
                  <div className="ml-auto flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      loading={bulkReassign.isPending}
                      onClick={() => void confirmReassign()}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={bulkReassign.isPending}
                      onClick={() => setPending(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
