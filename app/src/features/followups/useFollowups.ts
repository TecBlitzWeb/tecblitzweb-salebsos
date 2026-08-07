import { useMemo } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { CallRow } from '../../types/db'
import { callJoinKey, useCalls } from '../../api/calls'
import { useProspectViews, type ProspectView } from '../prospects/useProspectList'
import { canonicalRepKey } from '../../lib/repKey'
import { colomboDateTime } from '../../lib/format'

export type FollowupBucket = 'overdue' | 'today' | 'upcoming'

export interface FollowupItem {
  call: CallRow
  /** `yyyy-MM-dd` as stored. */
  due: string
  bucket: FollowupBucket
  /** Positive when overdue, 0 today, negative when upcoming. */
  daysOverdue: number
  /** Resolved by name join — null when the prospect was deleted (SPEC §0.14). */
  prospect: ProspectView | null
}

/** Today in Asia/Colombo, not UTC and not the browser's zone (SPEC §7). */
export function colomboToday(): string {
  return colomboDateTime().date
}

/**
 * A follow-up is a call carrying a non-empty `followup` date. There is no
 * separate table and no done flag — clearing the date is what "done" means.
 */
export function useFollowups(repFilter: string | null) {
  const calls = useCalls()
  const { byJoinKey, isLoading: prospectsLoading, error: prospectsError } = useProspectViews()

  const items = useMemo<FollowupItem[]>(() => {
    const today = colomboToday()
    const rows = calls.data ?? []

    return rows
      .filter((c) => (c.followup ?? '').trim())
      .map((call) => {
        const due = (call.followup ?? '').trim()
        // ISO yyyy-MM-dd compares correctly as a string, but the day delta
        // needs real dates.
        let daysOverdue = 0
        try {
          daysOverdue = differenceInCalendarDays(parseISO(today), parseISO(due))
        } catch {
          daysOverdue = 0
        }

        const bucket: FollowupBucket =
          due < today ? 'overdue' : due === today ? 'today' : 'upcoming'

        return {
          call,
          due,
          bucket,
          daysOverdue,
          prospect: byJoinKey.get(callJoinKey(call.prospect)) ?? null,
        }
      })
      .sort((a, b) => a.due.localeCompare(b.due))
  }, [calls.data, byJoinKey])

  const filtered = useMemo(() => {
    if (!repFilter) return items
    // Rep identity is only ever compared through canonicalRepKey (SPEC §0.13).
    const want = canonicalRepKey(repFilter).trim()
    return items.filter((i) => canonicalRepKey(i.call.rep).trim() === want)
  }, [items, repFilter])

  const buckets = useMemo(
    () => ({
      overdue: filtered.filter((i) => i.bucket === 'overdue'),
      today: filtered.filter((i) => i.bucket === 'today'),
      upcoming: filtered.filter((i) => i.bucket === 'upcoming'),
    }),
    [filtered]
  )

  /** Canonical rep key → representative spelling, for the filter chips. */
  const reps = useMemo(() => {
    const spellings = new Map<string, Map<string, number>>()
    for (const i of items) {
      const raw = (i.call.rep ?? '').trim()
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
        const count = items.filter((i) => canonicalRepKey(i.call.rep).trim() === key).length
        return { key, spelling, count }
      })
      .sort((a, b) => b.count - a.count)
  }, [items])

  return {
    buckets,
    reps,
    total: filtered.length,
    isLoading: calls.isLoading || prospectsLoading,
    error: calls.error ?? prospectsError ?? null,
    refetch: () => void calls.refetch(),
  }
}
