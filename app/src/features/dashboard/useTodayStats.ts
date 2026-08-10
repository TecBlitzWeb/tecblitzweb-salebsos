import { useMemo } from 'react'
import { subDays, parseISO, format } from 'date-fns'
import { useCalls } from '../../api/calls'
import { useClosedDeals } from '../../api/deals'
import { useInterestedLeads, parseLeadDate } from '../../api/leads'
import { canonicalRepKey } from '../../lib/repKey'
import { colomboDateTime } from '../../lib/format'

export interface DailyStat {
  value: number
  /** vs the same weekday last week — never a leaderboard, always self vs self. */
  delta: number
}

export interface TodayStats {
  callsLogged: DailyStat
  /** Counted from `interested_leads`, the table Pipeline reads — never from `calls.outcome`. */
  interestedCreated: DailyStat
  dealsClosed: DailyStat
  /** Today's own call count against this rep's own trailing average. Self-comparison only. */
  pace: { today: number; average: number }
  isLoading: boolean
  error: unknown
  refetch: () => void
}

function colomboDateOf(iso: string | null): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return colomboDateTime(new Date(t)).date
}

const PACE_WINDOW_DAYS = 30

/**
 * Today's three weekday-over-weekday deltas (calls, interested, deals) plus
 * the pace-bar ratio. Follow-ups due has no delta here — see useActionQueue
 * and TodayPage for why: "mark done" now sets `followup_done` and preserves
 * `calls.followup`, so this is recoverable going forward, but the rows
 * completed under the old clear-the-date behaviour have no date left. A past-week
 * delta would be wrong for those rather than merely missing.
 *
 * `callsLogged`/`dealsClosed` bucket by `createdat`/`created_at` — real
 * timestamptz columns. `interestedCreated` buckets by
 * `interested_leads."createdAt"`, which is TEXT; see parseLeadCreatedAt for
 * why that can't just be handed to `new Date()`.
 */
export function useTodayStats(repKey: string): TodayStats {
  const calls = useCalls()
  const deals = useClosedDeals()
  const leads = useInterestedLeads()

  const computed = useMemo(() => {
    const today = colomboDateTime().date
    const weekAgo = format(subDays(parseISO(today), 7), 'yyyy-MM-dd')
    const paceWindowStart = format(subDays(parseISO(today), PACE_WINDOW_DAYS), 'yyyy-MM-dd')

    const mineCalls = (calls.data ?? []).filter((c) => canonicalRepKey(c.rep).trim() === repKey)
    const mineDeals = (deals.data ?? []).filter((d) => canonicalRepKey(d.rep).trim() === repKey)
    const mineLeads = (leads.data ?? []).filter((l) => canonicalRepKey(l.rep).trim() === repKey)

    let callsToday = 0
    let callsWeekAgo = 0
    let paceWindowCount = 0

    for (const c of mineCalls) {
      const day = colomboDateOf(c.createdat)
      if (day === today) callsToday += 1
      else if (day === weekAgo) callsWeekAgo += 1
      if (day !== null && day >= paceWindowStart && day < today) paceWindowCount += 1
    }

    let dealsToday = 0
    let dealsWeekAgo = 0
    for (const d of mineDeals) {
      const day = colomboDateOf(d.created_at)
      if (day === today) dealsToday += 1
      else if (day === weekAgo) dealsWeekAgo += 1
    }

    // A row that fails to parse must not be silently excluded from the count
    // as if it never existed — it is surfaced as an error for this stat
    // instead, same as a network/RLS failure below.
    let interestedToday = 0
    let interestedWeekAgo = 0
    let leadParseError: unknown = null
    for (const lead of mineLeads) {
      let day: string | null
      try {
        day = colomboDateTime(new Date(parseLeadDate(lead.createdAt, 'createdAt'))).date
      } catch (err) {
        leadParseError = err
        continue
      }
      if (day === today) interestedToday += 1
      else if (day === weekAgo) interestedWeekAgo += 1
    }

    return {
      callsLogged: { value: callsToday, delta: callsToday - callsWeekAgo },
      interestedCreated: { value: interestedToday, delta: interestedToday - interestedWeekAgo },
      dealsClosed: { value: dealsToday, delta: dealsToday - dealsWeekAgo },
      pace: { today: callsToday, average: paceWindowCount / PACE_WINDOW_DAYS },
      isLoading: calls.isLoading || deals.isLoading || leads.isLoading,
      // Any source failing — including a lead row that didn't parse — makes
      // every card on this strip unverifiable. A stat built from an errored
      // or unparseable read is not a "0", it's unknown, so the whole strip
      // surfaces the error rather than mixing good and bad numbers.
      error: calls.error ?? deals.error ?? leads.error ?? leadParseError ?? null,
    }
  }, [
    calls.data,
    calls.isLoading,
    calls.error,
    deals.data,
    deals.isLoading,
    deals.error,
    leads.data,
    leads.isLoading,
    leads.error,
    repKey,
  ])

  return {
    ...computed,
    refetch: () => {
      void calls.refetch()
      void deals.refetch()
      void leads.refetch()
    },
  }
}
