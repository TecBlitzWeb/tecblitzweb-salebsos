import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CallRow } from '../types/db'
import { CALL_COLUMNS } from '../types/db'
import { fetchAllRows, toSupabaseError } from './supabaseQuery'
import { supabase } from '../lib/supabase'
import { colomboDateTime } from '../lib/format'
import type { CanonicalOutcome } from './outcomes'

/**
 * `calls.prospect` joins `prospects.name` by text with no foreign key, and
 * duplicate business names exist. So the join is N:N: one name key can map to
 * several prospect rows AND several calls. Everything downstream must treat a
 * name as a bucket, never as a unique reference (SPEC §0.7).
 */
export type CallsByName = Map<string, CallRow[]>

/** Text join key. Trimmed + lowercased so casing/padding drift doesn't split a bucket. */
export function callJoinKey(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

export function timeOf(iso: string | null): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/**
 * THE definition of "this call has an open follow-up". The SQL it mirrors:
 *
 *     followup is not null AND btrim(followup) <> '' AND followup_done = false
 *
 * Every consumer — the Follow-ups queue, the Today action queue, the Prospects
 * count strip — must call this and nothing else. There were four hand-rolled
 * copies of `(c.followup ?? '').trim()` before this existed, and none of them
 * knew about the done flag.
 *
 * Deliberately *not* keyed off `outcome`: 134 rows carry a real follow-up date
 * under a different outcome, and filtering by `'Follow-up needed'` drops them
 * silently.
 */
export function hasOpenFollowup(call: CallRow): boolean {
  return Boolean((call.followup ?? '').trim()) && call.followup_done === false
}

export function useCalls() {
  return useQuery({
    queryKey: ['calls', 'all'],
    queryFn: () => fetchAllRows<CallRow>('calls', CALL_COLUMNS, 'createdat'),
    staleTime: 30_000,
  })
}

/** Groups calls by join key, newest first within each bucket. */
export function groupCallsByName(calls: CallRow[]): CallsByName {
  const map: CallsByName = new Map()

  for (const call of calls) {
    const key = callJoinKey(call.prospect)
    if (!key) continue
    const bucket = map.get(key)
    if (bucket) bucket.push(call)
    else map.set(key, [call])
  }

  for (const bucket of map.values()) {
    bucket.sort((a, b) => timeOf(b.createdat) - timeOf(a.createdat))
  }

  return map
}

/**
 * Days since the most recent call for a name bucket. `null` = never called,
 * which the temperature bar renders as its own tier.
 *
 * Uses `calls.createdat` — authoritative on calls. Never `prospects.created_at`,
 * which is when the row was added, not when anyone called (SPEC §7).
 */
export function daysSinceLastCall(
  calls: CallRow[] | undefined,
  now: number = Date.now()
): number | null {
  if (!calls || calls.length === 0) return null
  const latest = timeOf(calls[0].createdat)
  if (!latest) return null
  return Math.floor((now - latest) / 86_400_000)
}

/* ------------------------------------------------------------------ writes */

export const CALLS_QUERY_KEY = ['calls', 'all'] as const

export interface LogCallInput {
  /** The prospect's business name — `calls.prospect` joins by text. */
  prospect: string
  outcome: CanonicalOutcome
  notes?: string
  phone?: string
  /** ISO date string, only when the outcome needs a follow-up. */
  followup?: string | null
  durationSeconds?: number | null
}

/**
 * Builds the row exactly as production stores it.
 *
 * - `id` is `crypto.randomUUID()`. v1 used `Date.now().toString()` and produced
 *   triplicate rows across devices (SPEC §0.9). Never do that again.
 * - `createdat` (lowercase) is the authoritative timestamp on `calls`, populated
 *   on every row. `"createdAt"` is dead there (0 rows) and is deliberately
 *   not written (SPEC §7).
 * - `date`/`time` are display-only text, written to match v1's shape so the
 *   old app keeps rendering rows this app creates.
 */
export function buildCallRow(input: LogCallInput, rep: string, now: Date = new Date()): CallRow {
  // `date`/`time` are Colombo wall clock; `createdat` is the UTC instant. Both
  // come from the same `now`, so they can never disagree about which day it is.
  const { date, time } = colomboDateTime(now)

  return {
    id: crypto.randomUUID(),
    prospect: input.prospect,
    rep,
    outcome: input.outcome,
    notes: input.notes?.trim() || null,
    phone: input.phone?.trim() || null,
    date,
    time,
    duration: input.durationSeconds ?? null,
    followup: input.followup?.trim() || null,
    // The DB default is false; written explicitly so the optimistic row in the
    // cache satisfies hasOpenFollowup() before the server row comes back.
    followup_done: false,
    createdat: now.toISOString(),
  }
}

/**
 * Optimistic insert with rollback.
 *
 * A failed write is never swallowed (SPEC §0.5): the cache is restored, the
 * error propagates to the caller so it can show a red toast with the status
 * code, and nothing sets a "skip forever" flag. The write runs through
 * supabase-js as the authenticated user, so RLS applies — a refusal surfaces
 * as 403 / Postgres 42501, never as a silent success.
 */
export function useLogCall() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ input, rep }: { input: LogCallInput; rep: string }) => {
      const row = buildCallRow(input, rep)
      const { data, error, status } = await supabase.from('calls').insert(row).select().single()
      if (error) throw toSupabaseError(error, status)
      return (data ?? row) as CallRow
    },

    onMutate: async ({ input, rep }) => {
      await queryClient.cancelQueries({ queryKey: CALLS_QUERY_KEY })
      const previous = queryClient.getQueryData<CallRow[]>(CALLS_QUERY_KEY)
      const optimistic = buildCallRow(input, rep)
      queryClient.setQueryData<CallRow[]>(CALLS_QUERY_KEY, (old) => [optimistic, ...(old ?? [])])
      return { previous }
    },

    onError: (_error, _vars, context) => {
      // Roll back to exactly what was there before. The error still throws to
      // the caller — this restores state, it does not absorb the failure.
      if (context?.previous) queryClient.setQueryData(CALLS_QUERY_KEY, context.previous)
    },

    onSuccess: () => {
      // Counts are derived from calls (temperature, follow-ups, never-called),
      // so the canonical count hook must recompute or the strip goes stale.
      void queryClient.invalidateQueries({ queryKey: CALLS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['prospects'] })
    },
  })
}

/**
 * Snooze or complete a follow-up.
 *
 * `calls.followup` is a DATE, and completing a follow-up must never destroy it.
 * 305 rows already lost their date to the old "mark done = write null" path and
 * cannot be recovered. So the two operations are separate cases here rather
 * than one nullable date argument:
 *
 * - `done`   → writes only `followup_done: true`. The date is never in the patch.
 * - `snooze` → writes the new date *and* `followup_done: false`, because a
 *              snoozed item is by definition not done; leaving a stale `true`
 *              would hide it from the queue permanently.
 *
 * There is intentionally no `reopen` case — the UI has no undo affordance, and
 * one is not being invented here.
 *
 * Optimistic with rollback; a failure is surfaced, never swallowed (SPEC §0.5).
 */
export type FollowupUpdate =
  | { id: string; kind: 'done' }
  /** `yyyy-MM-dd`, matching the 176 rows already stored. Never a datetime. */
  | { id: string; kind: 'snooze'; followup: string }

/** The exact column patch for an update — the single place `followup_done` is set. */
function followupPatch(update: FollowupUpdate): Partial<CallRow> {
  return update.kind === 'done'
    ? { followup_done: true }
    : { followup: update.followup, followup_done: false }
}

export function useUpdateFollowup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (update: FollowupUpdate) => {
      const { data, error, status } = await supabase
        .from('calls')
        .update(followupPatch(update))
        .eq('id', update.id)
        .select()
        .single()
      if (error) throw toSupabaseError(error, status)
      return data as CallRow
    },

    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey: CALLS_QUERY_KEY })
      const previous = queryClient.getQueryData<CallRow[]>(CALLS_QUERY_KEY)
      // Applies the same patch the server gets — including followup_done, or a
      // completed row would sit in the queue until the next refetch and the rep
      // would click it twice.
      const patch = followupPatch(update)
      queryClient.setQueryData<CallRow[]>(CALLS_QUERY_KEY, (old) =>
        (old ?? []).map((c) => (c.id === update.id ? { ...c, ...patch } : c))
      )
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(CALLS_QUERY_KEY, context.previous)
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CALLS_QUERY_KEY })
      // hasFollowUp feeds the Prospects count strip.
      void queryClient.invalidateQueries({ queryKey: ['prospects'] })
    },
  })
}

/** Inline outcome edit from the My Calls list. Same rules as the insert. */
export function useUpdateCallOutcome() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, outcome }: { id: string; outcome: CanonicalOutcome }) => {
      const { data, error, status } = await supabase
        .from('calls')
        .update({ outcome })
        .eq('id', id)
        .select()
        .single()
      if (error) throw toSupabaseError(error, status)
      return data as CallRow
    },

    onMutate: async ({ id, outcome }) => {
      await queryClient.cancelQueries({ queryKey: CALLS_QUERY_KEY })
      const previous = queryClient.getQueryData<CallRow[]>(CALLS_QUERY_KEY)
      queryClient.setQueryData<CallRow[]>(CALLS_QUERY_KEY, (old) =>
        (old ?? []).map((c) => (c.id === id ? { ...c, outcome } : c))
      )
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(CALLS_QUERY_KEY, context.previous)
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CALLS_QUERY_KEY })
    },
  })
}
