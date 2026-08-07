import { useMemo } from 'react'
import type { CallRow, ProspectRow } from '../../types/db'
import { useProspects, parsePackage, splitPhones } from '../../api/prospects'
import { callJoinKey, daysSinceLastCall, groupCallsByName, useCalls } from '../../api/calls'
import { temperatureTier, type TemperatureTier } from '../../lib/temperature'
import { canonicalRepKey } from '../../lib/repKey'

export type ProspectSort = 'coldest' | 'newest' | 'name'

export interface ProspectFilters {
  search: string
  assignee: string | null
  area: string | null
  type: string | null
  neverCalled: boolean
  hasFollowUp: boolean
  /** Cold or dead tier (8+ days since last contact). Derived, not stored. */
  cold: boolean
  /** Derived from the latest call's outcome — not a stored column. */
  outcome: string | null
  sort: ProspectSort
}

export const DEFAULT_FILTERS: ProspectFilters = {
  search: '',
  assignee: null,
  area: null,
  type: null,
  neverCalled: false,
  hasFollowUp: false,
  cold: false,
  outcome: null,
  sort: 'coldest',
}

/** Everything the "Clear filters" affordances reset. Sort is deliberately not a filter. */
export const CLEARED_FILTERS: Omit<ProspectFilters, 'sort'> = {
  search: '',
  assignee: null,
  area: null,
  type: null,
  neverCalled: false,
  hasFollowUp: false,
  cold: false,
  outcome: null,
}

/** True when any filter narrows the list. Single source of truth for "is a filter on?". */
export function hasActiveFilter(f: ProspectFilters): boolean {
  return (
    Boolean(f.search.trim() || f.assignee || f.area || f.type || f.outcome) ||
    f.neverCalled ||
    f.hasFollowUp ||
    f.cold
  )
}

/** A prospect row joined to its call bucket and everything derived from it. */
export interface ProspectView {
  row: ProspectRow
  calls: CallRow[]
  callCount: number
  daysSinceLastCall: number | null
  tier: TemperatureTier
  latestOutcome: string | null
  latestNote: string | null
  hasFollowUp: boolean
  packageLabel: string
  packageValue: number | null
  phones: string[]
  /** True when another row shares this business name — the join is ambiguous. */
  duplicateName: boolean
}

function matchesSearch(v: ProspectView, needle: string): boolean {
  if (!needle) return true
  const q = needle.trim().toLowerCase()
  if (!q) return true
  return (
    (v.row.name ?? '').toLowerCase().includes(q) ||
    (v.row.area ?? '').toLowerCase().includes(q) ||
    (v.row.type ?? '').toLowerCase().includes(q) ||
    (v.row.phone ?? '').toLowerCase().includes(q) ||
    // Both the stored spelling and the canonical identity, so searching the
    // name as displayed ("Himanthi") matches a row stored as "Himanthi2525".
    (v.row.assignedto ?? '').toLowerCase().includes(q) ||
    canonicalRepKey(v.row.assignedto).includes(q)
  )
}

/**
 * All prospects joined to their call buckets, unfiltered, plus a lookup keyed
 * by `callJoinKey`. Shared so Prospects and My Calls resolve a business name to
 * the same prospect — two independent join implementations would eventually
 * disagree, which is the class of bug that produced 189/193/172 in v1.
 */
export function useProspectViews() {
  const prospects = useProspects()
  const calls = useCalls()

  const views = useMemo<ProspectView[]>(() => {
    const rows = prospects.data
    if (!rows) return []

    const byName = groupCallsByName(calls.data ?? [])
    const nameTally = new Map<string, number>()
    for (const row of rows) {
      const key = callJoinKey(row.name)
      if (key) nameTally.set(key, (nameTally.get(key) ?? 0) + 1)
    }

    return rows.map((row) => buildProspectView(row, byName, nameTally))
  }, [prospects.data, calls.data])

  /** joinKey → first prospect with that name. Duplicates are flagged on the view. */
  const byJoinKey = useMemo(() => {
    const map = new Map<string, ProspectView>()
    for (const v of views) {
      const key = callJoinKey(v.row.name)
      if (key && !map.has(key)) map.set(key, v)
    }
    return map
  }, [views])

  return {
    views,
    byJoinKey,
    isLoading: prospects.isLoading || calls.isLoading,
    error: prospects.error ?? calls.error ?? null,
    refetch: () => {
      void prospects.refetch()
      void calls.refetch()
    },
  }
}

function buildProspectView(
  row: ProspectRow,
  byName: Map<string, CallRow[]>,
  nameTally: Map<string, number>
): ProspectView {
  const key = callJoinKey(row.name)
  const bucket = byName.get(key) ?? []
  const days = daysSinceLastCall(bucket)
  const pkg = parsePackage(row.pkg)
  const latest = bucket[0]

  return {
    row,
    calls: bucket,
    callCount: bucket.length,
    daysSinceLastCall: days,
    tier: temperatureTier(days),
    latestOutcome: latest?.outcome?.trim() || null,
    latestNote: latest?.notes?.trim() || null,
    hasFollowUp: bucket.some((c) => (c.followup ?? '').trim()),
    packageLabel: pkg.label,
    packageValue: pkg.value,
    phones: splitPhones(row.phone),
    duplicateName: (nameTally.get(key) ?? 0) > 1,
  }
}

export function useProspectList(filters: ProspectFilters) {
  const prospects = useProspects()
  const calls = useCalls()

  const views = useMemo<ProspectView[]>(() => {
    const rows = prospects.data
    if (!rows) return []

    const byName = groupCallsByName(calls.data ?? [])

    // Duplicate business names are real (SPEC §0.7) — flag them so the UI can
    // say the call history may belong to more than one row.
    const nameTally = new Map<string, number>()
    for (const row of rows) {
      const key = callJoinKey(row.name)
      if (key) nameTally.set(key, (nameTally.get(key) ?? 0) + 1)
    }

    return rows.map((row) => {
      const key = callJoinKey(row.name)
      const bucket = byName.get(key) ?? []
      const days = daysSinceLastCall(bucket)
      const pkg = parsePackage(row.pkg)
      const latest = bucket[0]

      return {
        row,
        calls: bucket,
        callCount: bucket.length,
        daysSinceLastCall: days,
        tier: temperatureTier(days),
        latestOutcome: latest?.outcome?.trim() || null,
        latestNote: latest?.notes?.trim() || null,
        hasFollowUp: bucket.some((c) => (c.followup ?? '').trim()),
        packageLabel: pkg.label,
        packageValue: pkg.value,
        phones: splitPhones(row.phone),
        duplicateName: (nameTally.get(key) ?? 0) > 1,
      }
    })
  }, [prospects.data, calls.data])

  const filtered = useMemo(() => {
    let list = views

    if (filters.assignee) {
      const want = canonicalRepKey(filters.assignee).trim()
      list = list.filter((v) => canonicalRepKey(v.row.assignedto).trim() === want)
    }
    if (filters.area) list = list.filter((v) => (v.row.area ?? '').trim() === filters.area)
    if (filters.type) list = list.filter((v) => (v.row.type ?? '').trim() === filters.type)
    if (filters.neverCalled) list = list.filter((v) => v.daysSinceLastCall === null)
    if (filters.hasFollowUp) list = list.filter((v) => v.hasFollowUp)
    // `tier` is computed in the `views` memo above, before any filtering runs,
    // so it is available here — this is a plain predicate like the others.
    if (filters.cold) list = list.filter((v) => v.tier === 'cold' || v.tier === 'dead')
    if (filters.outcome) {
      const want = filters.outcome.toLowerCase()
      list = list.filter((v) => (v.latestOutcome ?? '').toLowerCase() === want)
    }
    if (filters.search) list = list.filter((v) => matchesSearch(v, filters.search))

    const sorted = [...list]
    if (filters.sort === 'coldest') {
      // Never-called first (infinitely cold), then oldest contact first.
      sorted.sort((a, b) => (b.daysSinceLastCall ?? Infinity) - (a.daysSinceLastCall ?? Infinity))
    } else if (filters.sort === 'newest') {
      sorted.sort((a, b) => Date.parse(b.row.created_at ?? '') - Date.parse(a.row.created_at ?? ''))
    } else {
      sorted.sort((a, b) => (a.row.name ?? '').localeCompare(b.row.name ?? ''))
    }

    return sorted
  }, [views, filters])

  return {
    views: filtered,
    total: views.length,
    isLoading: prospects.isLoading || calls.isLoading,
    error: prospects.error ?? calls.error ?? null,
    refetch: () => {
      void prospects.refetch()
      void calls.refetch()
    },
  }
}
