import { useMemo } from 'react'
import { useProspects } from './prospects'
import { useCalls, callJoinKey, daysSinceLastCall, groupCallsByName } from './calls'
import { temperatureTier } from '../lib/temperature'
import { canonicalRepKey } from '../lib/repKey'

/**
 * THE canonical count source. Every page reads counts from here and nowhere
 * else. v1 computed Interested Leads independently on three pages and showed
 * 189 / 193 / 172 — three numbers for one fact. One hook, one answer (SPEC §7).
 *
 * All counts derive from the same RLS-scoped rows the list itself renders, so
 * the count strip can never disagree with the list beneath it.
 */
/**
 * One person, however they were spelled. `key` is the canonical identity used
 * for every comparison; `spelling` is the most common raw value seen for that
 * person, kept only so the UI has something real to render (SPEC §0.13).
 */
export interface AssigneeTally {
  key: string
  spelling: string
  count: number
}

export interface ProspectCounts {
  all: number
  neverCalled: number
  hasFollowUp: number
  cold: number
  mine: number
  /** Keyed by canonicalRepKey — never by the raw string. */
  byAssignee: Map<string, AssigneeTally>
  byArea: Map<string, number>
  byType: Map<string, number>
}

export const EMPTY_COUNTS: ProspectCounts = {
  all: 0,
  neverCalled: 0,
  hasFollowUp: 0,
  cold: 0,
  mine: 0,
  byAssignee: new Map(),
  byArea: new Map(),
  byType: new Map(),
}

function bump(map: Map<string, number>, key: string | null | undefined) {
  const k = (key ?? '').trim()
  if (!k) return
  map.set(k, (map.get(k) ?? 0) + 1)
}

/**
 * Tallies one prospect against its assignee's canonical identity, tracking how
 * often each raw spelling appears so the most common one can represent the
 * person in the UI.
 */
function bumpAssignee(
  map: Map<string, AssigneeTally>,
  spellings: Map<string, Map<string, number>>,
  raw: string | null | undefined
) {
  const value = (raw ?? '').trim()
  if (!value) return
  const key = canonicalRepKey(value).trim()
  if (!key) return

  const tally = map.get(key)
  if (tally) tally.count += 1
  else map.set(key, { key, spelling: value, count: 1 })

  const seen = spellings.get(key) ?? new Map<string, number>()
  seen.set(value, (seen.get(value) ?? 0) + 1)
  spellings.set(key, seen)
}

/** Promotes the most frequent raw spelling to be each person's display value. */
function resolveSpellings(
  map: Map<string, AssigneeTally>,
  spellings: Map<string, Map<string, number>>
) {
  for (const [key, seen] of spellings) {
    const tally = map.get(key)
    if (!tally) continue
    let best = tally.spelling
    let bestCount = -1
    for (const [value, n] of seen) {
      if (n > bestCount) {
        best = value
        bestCount = n
      }
    }
    tally.spelling = best
  }
}

export function useProspectCounts(repKey: string) {
  const prospects = useProspects()
  const calls = useCalls()

  const counts = useMemo<ProspectCounts>(() => {
    const rows = prospects.data
    if (!rows) return EMPTY_COUNTS

    const byName = groupCallsByName(calls.data ?? [])
    const result: ProspectCounts = {
      all: rows.length,
      neverCalled: 0,
      hasFollowUp: 0,
      cold: 0,
      mine: 0,
      byAssignee: new Map(),
      byArea: new Map(),
      byType: new Map(),
    }

    const spellings = new Map<string, Map<string, number>>()
    // Canonicalise the viewer's key once, so "mine" is an identity comparison
    // rather than a string-shape comparison.
    const mineKey = canonicalRepKey(repKey).trim()

    for (const row of rows) {
      const bucket = byName.get(callJoinKey(row.name))
      const days = daysSinceLastCall(bucket)
      const tier = temperatureTier(days)

      if (days === null) result.neverCalled += 1
      if (tier === 'cold' || tier === 'dead') result.cold += 1
      if (bucket?.some((c) => (c.followup ?? '').trim())) result.hasFollowUp += 1

      // Equality on canonical identity. Never startsWith — a prefix match looks
      // correct while digits are the only difference and silently fails on real
      // names ("san" matches "Sandaruwan"). See SPEC §0.13.
      if (mineKey && canonicalRepKey(row.assignedto).trim() === mineKey) result.mine += 1

      bumpAssignee(result.byAssignee, spellings, row.assignedto)
      bump(result.byArea, row.area)
      bump(result.byType, row.type)
    }

    resolveSpellings(result.byAssignee, spellings)
    return result
  }, [prospects.data, calls.data, repKey])

  return {
    counts,
    isLoading: prospects.isLoading || calls.isLoading,
    error: prospects.error ?? calls.error ?? null,
  }
}
