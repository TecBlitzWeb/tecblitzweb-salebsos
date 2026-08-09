import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InterestedLeadRow } from '../types/db'
import { INTERESTED_LEAD_COLUMNS } from '../types/db'
import { fetchAllRows, toSupabaseError } from './supabaseQuery'
import { supabase } from '../lib/supabase'

export const LEADS_QUERY_KEY = ['interested_leads', 'all'] as const

/**
 * RLS-scoped read of `interested_leads` — the table Pipeline reads, and the
 * table Today's "Interested created" stat counts from. Counting that stat off
 * `calls.outcome` instead would put two different numbers under one label,
 * which is the v1 failure this rebuild exists to kill.
 */
export function useInterestedLeads() {
  return useQuery({
    queryKey: LEADS_QUERY_KEY,
    // No `orderBy`: every date column on this table is TEXT and not guaranteed
    // to be uniformly formatted, so none can be trusted to sort server-side.
    // Pagination stays stable on `id` alone.
    queryFn: () => fetchAllRows<InterestedLeadRow>('interested_leads', INTERESTED_LEAD_COLUMNS),
    staleTime: 30_000,
  })
}

/**
 * Thrown by `parseLeadDate` — a distinct type so callers can tell a bad row
 * apart from a network/RLS failure and surface it as a data problem rather
 * than "check your connection".
 */
export class LeadDateParseError extends Error {
  readonly raw: string
  readonly column: string

  constructor(raw: string, column: string) {
    super(`interested_leads."${column}" is not a parseable ISO-8601 UTC string: ${JSON.stringify(raw)}`)
    this.name = 'LeadDateParseError'
    this.raw = raw
    this.column = column
  }
}

const ISO_UTC_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/
const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Every date on `interested_leads` is TEXT — `createdAt`, `callDate`,
 * `mockupSentAt`, `callbackAt`. Only `updated_at` is a real timestamptz.
 *
 * `new Date(raw)` would accept malformed or ambiguous strings via format
 * inference, which is exactly what produces a wrong-but-confident number. This
 * accepts only the two shapes the app actually writes — a full ISO-8601 UTC
 * instant, or a bare `yyyy-MM-dd` day — and throws on anything else. It never
 * returns a number for a string it did not actually parse.
 */
export function parseLeadDate(raw: string | null, column: string): number {
  const value = (raw ?? '').trim()

  const instant = ISO_UTC_RE.exec(value)
  if (instant) {
    const [, y, mo, d, h, mi, s, frac] = instant
    const ms = frac ? Number(frac.padEnd(3, '0').slice(0, 3)) : 0
    return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), ms)
  }

  const day = ISO_DAY_RE.exec(value)
  if (day) {
    const [, y, mo, d] = day
    return Date.UTC(Number(y), Number(mo) - 1, Number(d))
  }

  throw new LeadDateParseError(value, column)
}

/** Same parse, but `null` instead of throwing — for display-only reads where an
 * unreadable date should render as "—" rather than blank the whole page. */
export function tryParseLeadDate(raw: string | null): number | null {
  try {
    return parseLeadDate(raw, 'unknown')
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ writes */

export interface LeadStageUpdate {
  id: string
  status: string
  /** Written to `callbackNotes` — the Lost reason, or a callback note. */
  notes?: string
  /** Written to `callbackOutcome` — `won` | `lost` | `followup`. */
  outcome?: string
  /**
   * v1's Won handler sets this true (`index.html:13745`). v1 stays live through
   * the parallel week and reads the flag, so both apps must set it identically
   * or a lead won in v2 behaves differently in v1.
   */
  advanceCleared?: boolean
}

/**
 * Moves a lead between stages, mirroring v1's callback handler
 * (`index.html:13788-13796`) so both apps write the same vocabulary during the
 * parallel week: `callbackNotes`, `callbackOutcome` and `callbackAt` are set
 * together, and `status` carries the stage.
 *
 * Optimistic with rollback. A failure is surfaced with its status code, never
 * swallowed (SPEC §0.5).
 */
export function useUpdateLeadStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status, notes, outcome, advanceCleared }: LeadStageUpdate) => {
      const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
      if (outcome !== undefined) {
        patch.callbackOutcome = outcome
        // v1 stamps callbackAt whenever an outcome is recorded, so the two
        // always move together and "when did this land here" stays answerable.
        patch.callbackAt = new Date().toISOString()
      }
      if (notes !== undefined) patch.callbackNotes = notes
      if (advanceCleared !== undefined) patch.advance_cleared = advanceCleared

      const { data, error, status: httpStatus } = await supabase
        .from('interested_leads')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw toSupabaseError(error, httpStatus)
      return data as InterestedLeadRow
    },

    onMutate: async ({ id, status, notes, outcome, advanceCleared }) => {
      await queryClient.cancelQueries({ queryKey: LEADS_QUERY_KEY })
      const previous = queryClient.getQueryData<InterestedLeadRow[]>(LEADS_QUERY_KEY)
      queryClient.setQueryData<InterestedLeadRow[]>(LEADS_QUERY_KEY, (old) =>
        (old ?? []).map((l) =>
          l.id === id
            ? {
                ...l,
                status,
                ...(outcome !== undefined
                  ? { callbackOutcome: outcome, callbackAt: new Date().toISOString() }
                  : {}),
                ...(notes !== undefined ? { callbackNotes: notes } : {}),
                ...(advanceCleared !== undefined ? { advance_cleared: advanceCleared } : {}),
              }
            : l
        )
      )
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(LEADS_QUERY_KEY, context.previous)
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY })
    },
  })
}
