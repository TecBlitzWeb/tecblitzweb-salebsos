import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { addDays, format } from 'date-fns'
import { EmptyState } from '../../components/shared/EmptyState'
import { ErrorState } from '../../components/shared/ErrorState'
import { FilterChip } from '../../components/shared/FilterChip'
import { Skeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { ProspectDetail } from '../prospects/ProspectDetail'
import { LogCallSheet } from '../calls/LogCallSheet'
import type { ProspectView } from '../prospects/useProspectList'
import { useUpdateFollowup } from '../../api/calls'
import { describeWriteError } from '../../api/writeError'
import { SupabaseError } from '../../lib/queryClient'
import { displayRepName } from '../../lib/repKey'
import { FollowupRow } from './FollowupRow'
import { colomboToday, useFollowups, type FollowupBucket, type FollowupItem } from './useFollowups'

const BUCKETS: { key: FollowupBucket; label: string; tone: string }[] = [
  { key: 'overdue', label: 'Overdue', tone: 'text-danger' },
  { key: 'today', label: 'Today', tone: 'text-brand' },
  { key: 'upcoming', label: 'Upcoming', tone: 'text-text-muted' },
]

function readError(error: unknown): { message: string; status: number } {
  if (error instanceof SupabaseError) {
    if (error.status === 401) return { message: 'Your session expired. Sign in again.', status: 401 }
    if (error.status === 403) {
      return { message: `You don't have permission to read follow-ups.`, status: 403 }
    }
    return { message: `Couldn't load follow-ups. Check your connection.`, status: error.status }
  }
  return { message: `Couldn't load follow-ups. Check your connection.`, status: 0 }
}

export function FollowupsPage() {
  const { showToast } = useToast()
  const updateFollowup = useUpdateFollowup()
  const [repFilter, setRepFilter] = useState<string | null>(null)
  const [selected, setSelected] = useState<ProspectView | null>(null)
  const [logTarget, setLogTarget] = useState<{ prospect: string; phone: string } | null>(null)

  // Overdue open by default — it is the only bucket that needs action now (§7).
  const [open, setOpen] = useState<Record<FollowupBucket, boolean>>({
    overdue: true,
    today: true,
    upcoming: false,
  })

  const { buckets, reps, total, isLoading, error, refetch } = useFollowups(repFilter)

  async function apply(item: FollowupItem, followup: string | null, message: string) {
    try {
      await updateFollowup.mutateAsync({ id: item.call.id, followup })
      showToast({ message, tone: 'success' })
    } catch (err) {
      showToast({
        message: describeWriteError(err, followup ? 'snooze this follow-up' : 'mark this done'),
        tone: 'error',
      })
    }
  }

  const handlers = {
    onSnooze: (item: FollowupItem, days: number) => {
      // Snooze from today, not from the original due date — a follow-up three
      // weeks overdue snoozed "+1d" must land tomorrow, not three weeks ago.
      const next = format(addDays(new Date(`${colomboToday()}T00:00:00`), days), 'yyyy-MM-dd')
      void apply(item, next, `Snoozed to ${next}`)
    },
    onSnoozeTo: (item: FollowupItem, date: string) => {
      if (!date) return
      void apply(item, date, `Follow-up set to ${date}`)
    },
    onDone: (item: FollowupItem) => void apply(item, null, 'Follow-up done'),
    onOpen: (item: FollowupItem) => {
      if (item.prospect) setSelected(item.prospect)
    },
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-text-muted">
          <span className="tabular-nums text-text">{total.toLocaleString('en-US')}</span>{' '}
          {total === 1 ? 'follow-up' : 'follow-ups'}
        </p>
      </div>

      {reps.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="Everyone"
            active={repFilter === null}
            onClick={() => setRepFilter(null)}
          />
          {reps.map((r) => (
            <FilterChip
              key={r.key}
              label={displayRepName(r.spelling)}
              count={r.count}
              active={repFilter === r.key}
              onClick={() => setRepFilter(repFilter === r.key ? null : r.key)}
            />
          ))}
        </div>
      )}

      {error ? (
        <ErrorState {...readError(error)} onRetry={refetch} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState
          message={repFilter ? 'No follow-ups for this person.' : 'No follow-ups scheduled.'}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {BUCKETS.map(({ key, label, tone }) => {
            const items = buckets[key]
            const isOpen = open[key]
            return (
              <section key={key}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                  className="focus-ring flex w-full items-center gap-2 border-b border-border py-2 text-left"
                >
                  {isOpen ? (
                    <ChevronDown size={16} strokeWidth={1.75} className="text-text-subtle" />
                  ) : (
                    <ChevronRight size={16} strokeWidth={1.75} className="text-text-subtle" />
                  )}
                  <h2 className={clsx('font-display text-lg', tone)}>{label}</h2>
                  <span className="text-xs tabular-nums text-text-muted">{items.length}</span>
                </button>

                {isOpen &&
                  (items.length === 0 ? (
                    <p className="py-3 text-sm text-text-subtle">Nothing {label.toLowerCase()}.</p>
                  ) : (
                    <ul className="flex flex-col gap-2 py-2">
                      {items.map((item) => (
                        <FollowupRow key={item.call.id} item={item} {...handlers} />
                      ))}
                    </ul>
                  ))}
              </section>
            )
          })}
        </div>
      )}

      <ProspectDetail
        view={selected}
        onClose={() => setSelected(null)}
        onLogCall={(v) => {
          setSelected(null)
          setLogTarget({ prospect: v.row.name ?? '', phone: v.phones[0] ?? '' })
        }}
      />

      <LogCallSheet
        open={logTarget !== null}
        onClose={() => setLogTarget(null)}
        defaultProspect={logTarget?.prospect ?? ''}
        defaultPhone={logTarget?.phone ?? ''}
      />
    </div>
  )
}
