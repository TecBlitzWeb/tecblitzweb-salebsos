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
 * - `createdat` (lowercase) is the authoritative timestamp on `calls`
 *   (1074/1074). `"createdAt"` is dead there (0/1074) and is deliberately
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
