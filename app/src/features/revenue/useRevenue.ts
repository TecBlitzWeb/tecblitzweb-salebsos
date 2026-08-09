import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { useClosedDeals } from '../../api/deals'
import { useInterestedLeads } from '../../api/leads'
import { parsePackage } from '../../api/prospects'
import { canonicalRepKey } from '../../lib/repKey'
import { colomboDayOf, inRange, type DateRange } from '../../lib/dateRange'
import { colomboDateTime } from '../../lib/format'

export interface MonthBucket {
  /** `yyyy-MM`. */
  month: string
  /** `Aug 26`. */
  label: string
  revenue: number
  cumulative: number
}

export interface PackageSlice {
  label: string
  count: number
  value: number
}

export interface RepRevenue {
  key: string
  spelling: string
  value: number
  count: number
}

/**
 * `closed_deals.value` is `numeric`. PostgREST usually hands that back as a JSON
 * number but can send a string when precision would be lost, so every read is
 * coerced once here rather than trusted at each call site.
 */
function dealValue(raw: number | null): number {
  const n = typeof raw === 'number' ? raw : Number(raw ?? 0)
  return Number.isFinite(n) ? n : 0
}

/**
 * THE canonical revenue computation. Every figure on the Revenue page reads
 * from here so no two panels can disagree (SPEC §7).
 *
 * Two rules this hook exists to enforce:
 *
 * 1. **Revenue only ever comes from `closed_deals.value`.** `pkg` is a text
 *    label that happens to contain a price, and that price can disagree with
 *    what was actually charged. The label is used for grouping and nothing else.
 * 2. **Closed revenue and pipeline value are never added together.** They are
 *    returned as separate fields and must stay separate on screen — conflating
 *    them is how a business believes it made Rs 21M when it made Rs 0.
 *
 * Everything buckets on `closed_deals.created_at`, the real timestamptz. The
 * `date` column is TEXT and is display-only.
 */
export function useRevenue(range: DateRange) {
  const deals = useClosedDeals()
  const leads = useInterestedLeads()

  const computed = useMemo(() => {
    const allDeals = deals.data ?? []
    const inScope = allDeals.filter((d) => inRange(colomboDayOf(d.created_at), range))

    /* ---------------------------------------------------------- this month */
    const thisMonth = colomboDateTime().date.slice(0, 7)
    let monthRevenue = 0
    for (const d of allDeals) {
      const day = colomboDayOf(d.created_at)
      if (day && day.slice(0, 7) === thisMonth) monthRevenue += dealValue(d.value)
    }

    /* ------------------------------------------------- monthly bars + line */
    const byMonth = new Map<string, number>()
    for (const d of inScope) {
      const day = colomboDayOf(d.created_at)
      if (!day) continue
      const key = day.slice(0, 7)
      byMonth.set(key, (byMonth.get(key) ?? 0) + dealValue(d.value))
    }
    let running = 0
    const months: MonthBucket[] = [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, revenue]) => {
        running += revenue
        return {
          month,
          label: format(parseISO(`${month}-01`), 'MMM yy'),
          revenue,
          cumulative: running,
        }
      })

    /* -------------------------------------------------------- package mix */
    const mix = new Map<string, PackageSlice>()
    for (const d of inScope) {
      // Label for grouping; the money always comes from `value`.
      const label = parsePackage(d.pkg).label || 'Unlabelled'
      const slice = mix.get(label) ?? { label, count: 0, value: 0 }
      slice.count += 1
      slice.value += dealValue(d.value)
      mix.set(label, slice)
    }
    const packages = [...mix.values()].sort((a, b) => b.value - a.value)

    /* ---------------------------------------------------- per-rep revenue */
    // `closed_deals.rep` already stores canonical keys, but canonicalising again
    // is idempotent and keeps this join identical to every other rep join in the
    // app (SPEC §0.13). Never group on the raw string.
    const repMap = new Map<string, RepRevenue>()
    for (const d of inScope) {
      const key = canonicalRepKey(d.rep).trim()
      if (!key) continue
      const entry = repMap.get(key) ?? { key, spelling: (d.rep ?? '').trim() || key, value: 0, count: 0 }
      entry.value += dealValue(d.value)
      entry.count += 1
      repMap.set(key, entry)
    }
    const reps = [...repMap.values()].sort((a, b) => b.value - a.value)

    /* ------------------------------------------ pipeline value (ESTIMATE) */
    // Derived from the `pkg` label on leads that are still open. This is not
    // revenue and is returned separately so it cannot be summed by accident.
    let pipelineValue = 0
    let pipelineCount = 0
    for (const l of leads.data ?? []) {
      const status = (l.status ?? '').trim()
      if (status === 'won' || status === 'lost') continue
      const parsed = parsePackage(l.pkg).value
      if (parsed !== null) pipelineValue += parsed
      pipelineCount += 1
    }

    const totalRevenue = inScope.reduce((sum, d) => sum + dealValue(d.value), 0)

    return {
      /** False when the table itself is empty — a different state from "none in range". */
      hasAnyDeals: allDeals.length > 0,
      dealsInRange: inScope.length,
      totalRevenue,
      monthRevenue,
      months,
      packages,
      reps,
      /** Estimated, unclosed. Never added to `totalRevenue`. */
      pipelineValue,
      pipelineCount,
      rows: inScope,
    }
  }, [deals.data, leads.data, range])

  return {
    ...computed,
    isLoading: deals.isLoading || leads.isLoading,
    error: deals.error ?? leads.error ?? null,
    refetch: () => {
      void deals.refetch()
      void leads.refetch()
    },
  }
}
