import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClosedDealRow } from '../types/db'
import { CLOSED_DEAL_COLUMNS } from '../types/db'
import { fetchAllRows, toSupabaseError } from './supabaseQuery'
import { supabase } from '../lib/supabase'
import { canonicalRepKey } from '../lib/repKey'

export const DEALS_QUERY_KEY = ['closed_deals', 'all'] as const

/** RLS-scoped read of `closed_deals`. Feeds Today's "deals closed" stat and
 * Pipeline's Won-column total. */
export function useClosedDeals() {
  return useQuery({
    queryKey: DEALS_QUERY_KEY,
    queryFn: () => fetchAllRows<ClosedDealRow>('closed_deals', CLOSED_DEAL_COLUMNS, 'created_at'),
    staleTime: 30_000,
  })
}

export interface WonDealInput {
  /** `interested_leads.id`, or null when no lead sits behind the deal. */
  leadId: string | null
  /** `interested_leads.biz`. */
  biz: string
  /** Asked for by the Won sheet. Never defaulted — v1's 120000 fallback invented revenue. */
  value: number
  /** `yyyy-MM-dd`, from the Won sheet's date field. */
  date: string
  /** `interested_leads.pkg`, or the Won sheet's answer when the lead carries none. */
  pkg: string
  /** Stored raw; canonicalised on write to match v1's vocabulary. */
  rep: string | null
}

/**
 * Builds the `closed_deals` row exactly as production stores it — all nine
 * columns, none left empty:
 *
 * - `id`: `crypto.randomUUID()`. v1 used `String(Date.now())` for manual deals
 *   (`index.html:10907`), which duplicates across devices (SPEC §0.9).
 * - `rep`: `canonicalRepKey()`, matching v1's own Won handler
 *   (`index.html:13755`). v1 is still live and writing to this table, so both
 *   apps must speak one vocabulary. This deliberately differs from
 *   `prospects.assignedto`, which stores the display spelling.
 * - `source`: `'pipeline'` when a lead is behind the deal, `'manual'` otherwise —
 *   the only two values v1 writes (`index.html:13759`, `index.html:10907`).
 *   A third value would produce rows neither app counts.
 * - `date` is the Colombo day the rep says the deal closed and may legitimately
 *   differ from `created_at`, which is when the row was written. Anything
 *   time-based reads `created_at`.
 */
export function buildClosedDealRow(input: WonDealInput, now: Date = new Date()): ClosedDealRow {
  return {
    id: crypto.randomUUID(),
    biz: input.biz,
    value: input.value,
    rep: canonicalRepKey(input.rep) || null,
    date: input.date,
    pkg: input.pkg,
    leadId: input.leadId,
    source: input.leadId ? 'pipeline' : 'manual',
    created_at: now.toISOString(),
  }
}

export interface WonDealResult {
  row: ClosedDealRow | null
  /** True when the lead already had a deal and nothing was inserted. */
  duplicate: boolean
}

/**
 * Records a won deal.
 *
 * Keeps v1's idempotency guard (`index.html:13751`): a lead that already has a
 * `closed_deals` row is not recorded twice. The check runs against the server,
 * not local state — two devices winning the same lead is exactly how v1
 * produced duplicates.
 *
 * Not optimistic: the duplicate check is a server round-trip, so there is no
 * honest way to predict the outcome locally. A failure surfaces its status code
 * and is never swallowed (SPEC §0.5).
 */
export function useAddClosedDeal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: WonDealInput): Promise<WonDealResult> => {
      if (input.leadId) {
        const { data: existing, error: lookupError, status } = await supabase
          .from('closed_deals')
          .select('id')
          .eq('leadId', input.leadId)
          .limit(1)
        if (lookupError) throw toSupabaseError(lookupError, status)
        // Winning an already-won lead is a no-op, not a failure.
        if (existing && existing.length > 0) return { row: null, duplicate: true }
      }

      const row = buildClosedDealRow(input)
      const { data, error, status } = await supabase
        .from('closed_deals')
        .insert(row)
        .select()
        .single()
      if (error) throw toSupabaseError(error, status)
      return { row: (data ?? row) as ClosedDealRow, duplicate: false }
    },

    onSuccess: (result) => {
      if (result.duplicate) return
      void queryClient.invalidateQueries({ queryKey: DEALS_QUERY_KEY })
    },
  })
}
