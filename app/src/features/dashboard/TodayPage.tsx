import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/shared/EmptyState'
import { ErrorState } from '../../components/shared/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { StatCard } from '../../components/shared/StatCard'
import { useToast } from '../../components/ui/Toast'
import { SupabaseError } from '../../lib/queryClient'
import { useAuth } from '../../auth/useAuth'
import { LogCallSheet } from '../calls/LogCallSheet'
import { ProspectDetail } from '../prospects/ProspectDetail'
import type { ProspectView } from '../prospects/useProspectList'
import { useUpdateFollowup } from '../../api/calls'
import { describeWriteError } from '../../api/writeError'
import { LeadDateParseError } from '../../api/leads'
import { ActionRow } from './ActionRow'
import { ActivityFeed } from './ActivityFeed'
import { PaceBar } from './PaceBar'
import { Coverage } from './Coverage'
import { useActionQueue, type ActionItem } from './useActionQueue'
import { useTodayStats } from './useTodayStats'

const FOLLOWUPS_DUE_HINT =
  "No week-over-week comparison — marking a follow-up done clears its due date, so there's no record of what was due on a past date."

function readError(error: unknown): { message: string; status: number } {
  if (error instanceof SupabaseError) {
    if (error.status === 401) return { message: 'Your session expired. Sign in again.', status: 401 }
    if (error.status === 403) {
      return { message: `You don't have permission to read today's queue.`, status: 403 }
    }
    return { message: `Couldn't load today's queue. Check your connection.`, status: error.status }
  }
  return { message: `Couldn't load today's queue. Check your connection.`, status: 0 }
}

function readStatsError(error: unknown): { message: string; status: number } {
  if (error instanceof LeadDateParseError) {
    return {
      message: `A lead record has a date that can't be read (${error.raw || 'empty'}). Numbers may be undercounted until it's fixed.`,
      status: 0,
    }
  }
  if (error instanceof SupabaseError) {
    if (error.status === 401) return { message: 'Your session expired. Sign in again.', status: 401 }
    if (error.status === 403) {
      return { message: `You don't have permission to read today's numbers.`, status: 403 }
    }
    return { message: `Couldn't load today's numbers. Check your connection.`, status: error.status }
  }
  return { message: `Couldn't load today's numbers. Check your connection.`, status: 0 }
}

export function TodayPage() {
  const { repKey, role } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const updateFollowup = useUpdateFollowup()

  const [selected, setSelected] = useState<ProspectView | null>(null)
  const [logTarget, setLogTarget] = useState<{ prospect: string; phone: string } | null>(null)

  const queue = useActionQueue(repKey)
  const stats = useTodayStats(repKey)

  const isManager = role === 'CEO' || role === 'Co-CEO'

  function openItem(item: ActionItem) {
    if (item.prospect) setSelected(item.prospect)
  }

  function logCallFor(item: ActionItem) {
    setLogTarget({ prospect: item.name, phone: item.phones[0] ?? '' })
  }

  async function handleDone(item: ActionItem) {
    if (!item.followup) return
    try {
      await updateFollowup.mutateAsync({ id: item.followup.call.id, followup: null })
      showToast({ message: 'Follow-up done', tone: 'success' })
    } catch (error) {
      showToast({ message: describeWriteError(error, 'mark this done'), tone: 'error' })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg text-text">Up next</h2>

        {queue.error ? (
          <ErrorState {...readError(queue.error)} onRetry={queue.refetch} />
        ) : queue.isLoading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-md" />
            ))}
          </div>
        ) : queue.items.length === 0 ? (
          <EmptyState
            message="Nothing due. Want to work the coldest prospects?"
            action={
              <Button variant="secondary" size="sm" onClick={() => navigate('/prospects')}>
                Work coldest prospects
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {queue.items.map((item) => (
              <li key={item.id} className="group relative">
                <ActionRow
                  item={item}
                  onOpen={() => openItem(item)}
                  onLogCall={() => logCallFor(item)}
                />
                {item.followup && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDone(item)
                    }}
                    className="focus-ring absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-sm border border-border-strong bg-surface px-2 py-1 text-2xs text-text-muted hover:bg-surface-2 lg:group-hover:block"
                  >
                    Done
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        {/*
          Follow-ups due draws its value from `queue`, not `stats` — either
          source failing makes that card unverifiable too, so both errors gate
          the whole strip. A stat built on a failed read is not a "0", it's
          unknown; showing zero here is exactly the bug that hid v1's revenue.
        */}
        {(stats.error ?? queue.error) ? (
          <ErrorState
            {...readStatsError(stats.error ?? queue.error)}
            onRetry={() => {
              stats.refetch()
              queue.refetch()
            }}
          />
        ) : stats.isLoading || queue.isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-md" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Calls logged"
              value={String(stats.callsLogged.value)}
              delta={stats.callsLogged.delta}
              deltaLabel="vs last week"
            />
            <StatCard
              label="Interested created"
              value={String(stats.interestedCreated.value)}
              delta={stats.interestedCreated.delta}
              deltaLabel="vs last week"
            />
            <StatCard
              label="Follow-ups due"
              value={String(queue.followupsDue)}
              hint={FOLLOWUPS_DUE_HINT}
            />
            <StatCard
              label="Deals closed"
              value={String(stats.dealsClosed.value)}
              delta={stats.dealsClosed.delta}
              deltaLabel="vs last week"
            />
          </div>
        )}
      </section>

      <PaceBar today={stats.pace.today} average={stats.pace.average} />

      <ActivityFeed />

      {isManager && <Coverage />}

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
