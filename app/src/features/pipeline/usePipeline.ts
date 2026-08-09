import { useMemo } from 'react'
import type { InterestedLeadRow } from '../../types/db'
import { useInterestedLeads, tryParseLeadDate } from '../../api/leads'
import { useClosedDeals } from '../../api/deals'
import { useProspectViews, type ProspectView } from '../prospects/useProspectList'
import { callJoinKey } from '../../api/calls'
import { parsePackage, splitPhones } from '../../api/prospects'
import { canonicalRepKey } from '../../lib/repKey'

/**
 * The stored `interested_leads.status` values, taken from v1's own label map
 * (`index.html:13548`). This is a data contract, not a UI preference — writing
 * anything else creates rows v1's dashboards silently fail to count.
 *
 * Grounded from v1 source rather than a `select distinct status` against
 * production, which this client has no credentials to run. Any status outside
 * this list is therefore surfaced in its own column rather than dropped — an
 * unrecognised stage must never make a lead invisible (SPEC §0.14).
 */
export const PIPELINE_STAGES = [
  { key: 'new', label: 'New' },
  { key: 'pending', label: 'Mockup sent' },
  { key: 'called', label: 'Callback' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
] as const

export type StageKey = (typeof PIPELINE_STAGES)[number]['key']

/** Column for leads whose status matches no known stage. Only rendered when non-empty. */
export const UNKNOWN_STAGE = 'unknown'

export interface LeadView {
  row: InterestedLeadRow
  /** `new` | `pending` | `called` | `won` | `lost` | `unknown`. */
  stage: string
  /** As stored, shown when `stage` is `unknown` so the real value stays visible. */
  rawStatus: string
  /** Joined prospect, for the temperature bar. Null when the name matches none. */
  prospect: ProspectView | null
  /** Temperature comes from call history, not the lead. Null = never called. */
  daysSinceLastCall: number | null
  packageLabel: string
  /** Parsed from `pkg`. An *estimate* — the real figure is asked for on Won. */
  packageValue: number | null
  /** Every number on the lead — a row with two offers both. */
  phones: string[]
  /** Days since the lead entered its current stage, or null when unparseable. */
  daysInStage: number | null
  /** The recorded deal, for leads in Won. Null when none was ever written. */
  closedValue: number | null
}

/**
 * When each stage began. Every one of these columns is TEXT (SPEC §7), so they
 * are parsed explicitly — an unreadable date yields null and renders as "—",
 * never a silently wrong day count.
 */
function stageEnteredAt(row: InterestedLeadRow, stage: string): number | null {
  if (stage === 'called' || stage === 'won' || stage === 'lost') {
    return tryParseLeadDate(row.callbackAt) ?? tryParseLeadDate(row.createdAt)
  }
  if (stage === 'pending') {
    return tryParseLeadDate(row.mockupSentAt) ?? tryParseLeadDate(row.createdAt)
  }
  return tryParseLeadDate(row.createdAt)
}

const KNOWN = new Set<string>(PIPELINE_STAGES.map((s) => s.key))

export interface StageTotal {
  key: string
  label: string
  count: number
  /** Won: real money from `closed_deals`. Other stages: estimated, unclosed. */
  value: number
  /** True when `value` is a parsed-package estimate, not recorded revenue. */
  estimated: boolean
}

/**
 * THE canonical pipeline computation. Column headers, mobile stage tabs and the
 * card lists all read from this one hook, so a count in a header can never
 * disagree with the list beneath it — the class of bug that produced v1's
 * 189/193/172 for a single metric (SPEC §7).
 *
 * Rep identity is only ever compared through `canonicalRepKey` (SPEC §0.13);
 * no grouping anywhere here touches the raw string.
 */
export function usePipeline(repFilter: string | null) {
  const leads = useInterestedLeads()
  const deals = useClosedDeals()
  const { byJoinKey, isLoading: prospectsLoading, error: prospectsError } = useProspectViews()

  /** leadId → recorded deal value. The Won column shows real revenue, not an estimate. */
  const valueByLeadId = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of deals.data ?? []) {
      if (!d.leadId) continue
      const value = typeof d.value === 'number' ? d.value : Number(d.value ?? 0)
      if (Number.isFinite(value)) map.set(d.leadId, (map.get(d.leadId) ?? 0) + value)
    }
    return map
  }, [deals.data])

  const views = useMemo<LeadView[]>(() => {
    const now = Date.now()

    return (leads.data ?? []).map((row) => {
      const rawStatus = (row.status ?? '').trim()
      const stage = KNOWN.has(rawStatus) ? rawStatus : UNKNOWN_STAGE
      const prospect = byJoinKey.get(callJoinKey(row.biz)) ?? null
      const pkg = parsePackage(row.pkg)
      const enteredAt = stageEnteredAt(row, stage)

      // The lead carries its own phone; the joined prospect may hold two.
      const leadPhones = splitPhones(row.phone)
      const phones = leadPhones.length > 0 ? leadPhones : (prospect?.phones ?? [])

      return {
        row,
        stage,
        rawStatus,
        prospect,
        daysSinceLastCall: prospect?.daysSinceLastCall ?? null,
        packageLabel: pkg.label,
        packageValue: pkg.value,
        phones,
        daysInStage: enteredAt === null ? null : Math.floor((now - enteredAt) / 86_400_000),
        closedValue: valueByLeadId.get(row.id) ?? null,
      }
    })
  }, [leads.data, byJoinKey, valueByLeadId])

  const filtered = useMemo(() => {
    if (!repFilter) return views
    const want = canonicalRepKey(repFilter).trim()
    return views.filter((v) => canonicalRepKey(v.row.rep).trim() === want)
  }, [views, repFilter])

  const byStage = useMemo(() => {
    const map = new Map<string, LeadView[]>()
    for (const stage of PIPELINE_STAGES) map.set(stage.key, [])
    map.set(UNKNOWN_STAGE, [])

    for (const v of filtered) {
      const bucket = map.get(v.stage)
      if (bucket) bucket.push(v)
    }

    // Longest-waiting first inside every column: the card most at risk of going
    // stale sits at the top, which is the whole point of days-in-stage.
    for (const bucket of map.values()) {
      bucket.sort((a, b) => (b.daysInStage ?? -1) - (a.daysInStage ?? -1))
    }
    return map
  }, [filtered])

  const totals = useMemo<StageTotal[]>(() => {
    const out: StageTotal[] = PIPELINE_STAGES.map((stage) => {
      const bucket = byStage.get(stage.key) ?? []
      const isWon = stage.key === 'won'
      const value = bucket.reduce((sum, v) => {
        // Won totals recorded revenue. Everything else can only be estimated
        // from the package text, and DESIGN_RULES §7 forbids presenting the two
        // as the same kind of number.
        if (isWon) return sum + (v.closedValue ?? 0)
        return sum + (v.packageValue ?? 0)
      }, 0)
      return { key: stage.key, label: stage.label, count: bucket.length, value, estimated: !isWon }
    })

    const unknown = byStage.get(UNKNOWN_STAGE) ?? []
    if (unknown.length > 0) {
      out.push({
        key: UNKNOWN_STAGE,
        label: 'Unrecognised stage',
        count: unknown.length,
        value: unknown.reduce((sum, v) => sum + (v.packageValue ?? 0), 0),
        estimated: true,
      })
    }
    return out
  }, [byStage])

  /** Canonical rep key → representative spelling, for the filter chips. */
  const reps = useMemo(() => {
    const spellings = new Map<string, Map<string, number>>()
    for (const v of views) {
      const raw = (v.row.rep ?? '').trim()
      if (!raw) continue
      const key = canonicalRepKey(raw).trim()
      if (!key) continue
      const seen = spellings.get(key) ?? new Map<string, number>()
      seen.set(raw, (seen.get(raw) ?? 0) + 1)
      spellings.set(key, seen)
    }

    return [...spellings.entries()]
      .map(([key, seen]) => {
        let spelling = key
        let best = -1
        for (const [value, n] of seen) {
          if (n > best) {
            spelling = value
            best = n
          }
        }
        const count = views.filter((v) => canonicalRepKey(v.row.rep).trim() === key).length
        return { key, spelling, count }
      })
      .sort((a, b) => b.count - a.count)
  }, [views])

  return {
    byStage,
    totals,
    reps,
    total: filtered.length,
    isLoading: leads.isLoading || deals.isLoading || prospectsLoading,
    error: leads.error ?? deals.error ?? prospectsError ?? null,
    refetch: () => {
      void leads.refetch()
      void deals.refetch()
    },
  }
}
