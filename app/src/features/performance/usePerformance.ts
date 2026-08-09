import { useMemo } from 'react'
import { useCalls, callJoinKey } from '../../api/calls'
import { useProspects } from '../../api/prospects'
import { useInterestedLeads, tryParseLeadDate } from '../../api/leads'
import { useClosedDeals } from '../../api/deals'
import { useSalesUsers } from '../../api/users'
import { canonicalRepKey } from '../../lib/repKey'
import { colomboDayOf, inRange, type DateRange } from '../../lib/dateRange'
import { colomboDateTime } from '../../lib/format'

/**
 * Connect is about whether a human was reached, not whether the call went well.
 * "Not interested" counts as connected — they answered and said no, which is a
 * conversation. "WhatsApp sent" does not — nobody picked up.
 *
 * Verified against the live `calls.outcome` distribution: Follow-up needed 347,
 * Not interested 301, Interested 205, No answer 197, WhatsApp sent 95.
 */
const CONNECTED_OUTCOMES = new Set(['follow-up needed', 'not interested', 'interested'])
const NOT_CONNECTED_OUTCOMES = new Set(['no answer', 'whatsapp sent'])

/** `calls.outcome` value that decides the interested-lead reconciliation. */
const INTERESTED_OUTCOME = 'interested'

export interface RepPerformance {
  key: string
  spelling: string
  role: string | null
  calls: number
  connected: number
  notConnected: number
  /**
   * Calls whose outcome matches none of the five known values. Counted, never
   * folded into either side of the connect rate.
   */
  unknownOutcomes: number
  /** connected ÷ (connected + notConnected). Null when neither side has a call. */
  connectRate: number | null
  interested: number
  interestedRate: number | null
  closed: number
  closeRate: number | null
  /** Null when this rep has no recorded deals — never rendered as Rs 0. */
  revenue: number | null
  /** Calls per day across the range, for the sparkline. */
  trend: number[]
  /** True when the rep appears in data but not in `sales_users`. */
  offRoster: boolean
}

/**
 * Four independent counts, deliberately *not* a funnel with drop-off rates.
 *
 * Each step measures a different population over the same window — prospects
 * added, prospects called, leads created, deals closed — and none of them is a
 * subset of the one above it. A percentage between two such counts asserts a
 * cohort relationship that does not exist in this data. A real cohort funnel
 * would need to follow one set of prospects through every stage, and it would
 * terminate in zero until deals are actually recorded.
 */
export interface FunnelStep {
  label: string
  count: number
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return (numerator / denominator) * 100
}

function dealValue(raw: number | null): number {
  const n = typeof raw === 'number' ? raw : Number(raw ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Ordered list of Colombo days spanned by the range, for the sparkline buckets. */
function daysOf(range: DateRange, fallbackDays: string[]): string[] {
  if (!range.start || !range.end) {
    return [...new Set(fallbackDays)].sort()
  }
  const out: string[] = []
  const cursor = new Date(`${range.start}T00:00:00Z`)
  const end = new Date(`${range.end}T00:00:00Z`)
  while (cursor <= end && out.length < 400) {
    out.push(colomboDateTime(cursor).date)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

/**
 * THE canonical performance computation.
 *
 * Two rules this hook exists to enforce:
 *
 * 1. **Every role appears.** The roster is all of `sales_users` regardless of
 *    role, plus anyone who shows up in the data but not the roster. v1 filtered
 *    to `role = 'Sales'` and hid 332 calls belonging to the CEO and Co-CEO
 *    (SPEC §5.7). A rep with no calls still gets a row, so absence is visible.
 * 2. **Rep identity is compared only through `canonicalRepKey`.** `calls.rep`
 *    and `prospects.assignedto` carry display spellings with trailing digits;
 *    `closed_deals.rep` already holds canonical keys. Joining without
 *    canonicalising both sides splits one person into two rows (SPEC §0.13).
 */
export function usePerformance(range: DateRange) {
  const calls = useCalls()
  const prospects = useProspects()
  const leads = useInterestedLeads()
  const deals = useClosedDeals()
  const users = useSalesUsers()

  const computed = useMemo(() => {
    const callRows = (calls.data ?? []).filter((c) => inRange(colomboDayOf(c.createdat), range))
    const dealRows = (deals.data ?? []).filter((d) => inRange(colomboDayOf(d.created_at), range))
    const prospectRows = (prospects.data ?? []).filter((p) =>
      inRange(colomboDayOf(p.created_at), range)
    )

    // `interested_leads."createdAt"` is TEXT — parsed explicitly, never inferred.
    let leadParseFailures = 0
    const leadRows = (leads.data ?? []).filter((l) => {
      const ms = tryParseLeadDate(l.createdAt)
      if (ms === null) {
        leadParseFailures += 1
        return false
      }
      return inRange(colomboDateTime(new Date(ms)).date, range)
    })

    /* ------------------------------------------------------------- roster */
    const rows = new Map<string, RepPerformance>()
    const ensure = (key: string, spelling: string, role: string | null, offRoster: boolean) => {
      let row = rows.get(key)
      if (!row) {
        row = {
          key,
          spelling,
          role,
          calls: 0,
          connected: 0,
          notConnected: 0,
          unknownOutcomes: 0,
          connectRate: null,
          interested: 0,
          interestedRate: null,
          closed: 0,
          closeRate: null,
          revenue: null,
          trend: [],
          offRoster,
        }
        rows.set(key, row)
      }
      return row
    }

    // Every role, never filtered.
    for (const u of users.data ?? []) {
      const key = canonicalRepKey(u.username).trim() || canonicalRepKey(u.name).trim()
      if (!key) continue
      ensure(key, u.name || u.username || key, u.role, false)
    }

    /* ------------------------------------------------------------ metrics */
    const days = daysOf(
      range,
      callRows.map((c) => colomboDayOf(c.createdat) ?? '').filter(Boolean)
    )
    const dayIndex = new Map(days.map((d, i) => [d, i]))
    const trends = new Map<string, number[]>()

    // Outcomes outside the five known values, tallied by their raw text so the
    // page can name them. Never bucketed into connected or not-connected.
    const unrecognised = new Map<string, number>()

    for (const c of callRows) {
      const key = canonicalRepKey(c.rep).trim()
      if (!key) continue
      const row = ensure(key, (c.rep ?? '').trim() || key, null, true)
      row.calls += 1

      const outcome = (c.outcome ?? '').trim().toLowerCase()
      if (CONNECTED_OUTCOMES.has(outcome)) {
        row.connected += 1
      } else if (NOT_CONNECTED_OUTCOMES.has(outcome)) {
        row.notConnected += 1
      } else {
        row.unknownOutcomes += 1
        const label = (c.outcome ?? '').trim() || '(blank)'
        unrecognised.set(label, (unrecognised.get(label) ?? 0) + 1)
      }

      const day = colomboDayOf(c.createdat)
      const idx = day ? dayIndex.get(day) : undefined
      if (idx !== undefined) {
        const series = trends.get(key) ?? new Array<number>(days.length).fill(0)
        series[idx] += 1
        trends.set(key, series)
      }
    }

    for (const l of leadRows) {
      const key = canonicalRepKey(l.rep).trim()
      if (!key) continue
      ensure(key, (l.rep ?? '').trim() || key, null, true).interested += 1
    }

    for (const d of dealRows) {
      const key = canonicalRepKey(d.rep).trim()
      if (!key) continue
      const row = ensure(key, (d.rep ?? '').trim() || key, null, true)
      row.closed += 1
      row.revenue = (row.revenue ?? 0) + dealValue(d.value)
    }

    for (const row of rows.values()) {
      // Denominator is only the calls we can actually classify. Folding unknown
      // outcomes into either side would quietly move the rate.
      row.connectRate = rate(row.connected, row.connected + row.notConnected)
      row.interestedRate = rate(row.interested, row.calls)
      // Close rate is deals over interested leads — the step the funnel below
      // measures. Over total calls it would read near-zero and mean nothing.
      row.closeRate = rate(row.closed, row.interested)
      row.trend = trends.get(row.key) ?? new Array<number>(days.length).fill(0)
    }

    const reps = [...rows.values()].sort((a, b) => {
      // Zero-call reps sink to the bottom but are never removed.
      if (a.calls !== b.calls) return b.calls - a.calls
      return a.spelling.localeCompare(b.spelling)
    })

    /* ------------------------------------------------------------- funnel */
    const calledNames = new Set<string>()
    for (const c of callRows) {
      const key = callJoinKey(c.prospect)
      if (key) calledNames.add(key)
    }

    const funnel: FunnelStep[] = [
      { label: 'Prospects added', count: prospectRows.length },
      { label: 'Called', count: calledNames.size },
      { label: 'Interested', count: leadRows.length },
      { label: 'Closed', count: dealRows.length },
    ]

    /* ------------------------------------- interested-lead reconciliation */
    // Deliberately all-time, not range-scoped: this is a standing integrity
    // fact about two tables that should agree, and scoping it to a range would
    // make it flicker in and out as timing shifts rows across the boundary.
    let interestedCallsAll = 0
    for (const c of calls.data ?? []) {
      if ((c.outcome ?? '').trim().toLowerCase() === INTERESTED_OUTCOME) interestedCallsAll += 1
    }
    const leadRowsAll = (leads.data ?? []).length

    return {
      reps,
      funnel,
      days,
      hasAnyDeals: (deals.data ?? []).length > 0,
      leadParseFailures,
      unrecognisedOutcomes: [...unrecognised.entries()]
        .map(([outcome, count]) => ({ outcome, count }))
        .sort((a, b) => b.count - a.count),
      interestedReconciliation: {
        interestedCalls: interestedCallsAll,
        leads: leadRowsAll,
        /** Positive when interested calls outnumber the leads they should have created. */
        gap: interestedCallsAll - leadRowsAll,
      },
    }
  }, [calls.data, prospects.data, leads.data, deals.data, users.data, range])

  return {
    ...computed,
    isLoading:
      calls.isLoading || prospects.isLoading || leads.isLoading || deals.isLoading || users.isLoading,
    error: calls.error ?? prospects.error ?? leads.error ?? deals.error ?? users.error ?? null,
    refetch: () => {
      void calls.refetch()
      void prospects.refetch()
      void leads.refetch()
      void deals.refetch()
    },
  }
}
