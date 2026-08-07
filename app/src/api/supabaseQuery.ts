import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { SupabaseError } from '../lib/queryClient'

/**
 * PostgREST caps a single response (max-rows). `calls` already exceeds 1000
 * rows in production, so every full-table read must page or it silently
 * truncates — exactly the bug v1 hit.
 */
const PAGE_SIZE = 500

/**
 * Translates a PostgREST failure into a SupabaseError carrying the HTTP
 * status, so queryClient's retry policy can tell 401 from 403 (SPEC §7).
 * RLS denial on *read* is not an error — it comes back as 200 with `[]`.
 */
export function toSupabaseError(error: PostgrestError, status: number): SupabaseError {
  return new SupabaseError(error.message, status, error.code)
}

export async function fetchAllRows<T>(table: string, columns: string, orderBy?: string): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1)

    if (orderBy) {
      // Stable secondary key on id — without it, equal sort keys can repeat or
      // drop rows across page boundaries.
      query = query.order(orderBy, { ascending: false }).order('id', { ascending: true })
    } else {
      query = query.order('id', { ascending: true })
    }

    const { data, error, status } = await query
    if (error) throw toSupabaseError(error, status)

    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
}
