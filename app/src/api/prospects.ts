import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProspectRow } from '../types/db'
import { PROSPECT_COLUMNS } from '../types/db'
import { fetchAllRows, toSupabaseError } from './supabaseQuery'
import { PALETTE_PROSPECTS_KEY } from './palette'
import { supabase } from '../lib/supabase'

/**
 * Reads are RLS-scoped: the database decides which rows this user sees, and an
 * RLS denial arrives as 200 with `[]`, never 401. Client-side filtering below
 * is for UX only — it must never be the thing enforcing visibility (SPEC §7).
 *
 * Ordering is server-side on `created_at` (authoritative, 677/677). "Coldest
 * first" cannot be ordered server-side because it derives from
 * `max(calls.createdat)`, which is not a column on prospects — that sort runs
 * client-side after the join. See SPEC §5.2.
 */
export const PROSPECTS_QUERY_KEY = ['prospects', 'all'] as const

/**
 * A row is live unless it carries a `deleted_at`. Truthiness, not `=== null`:
 * an optimistically inserted row can arrive before the column is echoed back,
 * and `undefined` must read as live rather than as trash.
 */
export function isLive(row: Pick<ProspectRow, 'deleted_at'>): boolean {
  return !row.deleted_at
}

const fetchProspects = () =>
  fetchAllRows<ProspectRow>('prospects', PROSPECT_COLUMNS, 'created_at')

/**
 * Every live prospect. This is the only full read of the table, so filtering the
 * trash out here is what keeps it out of every list, count, stat card, filter,
 * sort and rep queue in the app — they all derive from this one hook.
 *
 * The filter is a `select`, not part of `queryFn`: the cache holds the unfiltered
 * table under one key, so [useDeletedProspects] renders the trash from the same
 * fetch instead of a second one, and the optimistic writers below keep mutating
 * whole rows rather than a filtered view.
 */
export function useProspects() {
  return useQuery({
    queryKey: PROSPECTS_QUERY_KEY,
    queryFn: fetchProspects,
    staleTime: 30_000,
    select: (rows: ProspectRow[]) => rows.filter(isLive),
  })
}

/** The trash: the same cached fetch, inverted. Newest deletion first. */
export function useDeletedProspects() {
  return useQuery({
    queryKey: PROSPECTS_QUERY_KEY,
    queryFn: fetchProspects,
    staleTime: 30_000,
    select: (rows: ProspectRow[]) =>
      rows
        .filter((row) => !isLive(row))
        .sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? '')),
  })
}

/**
 * `pkg` is free text with the value embedded, e.g. "Landing Page - 65,000".
 * Parsed for display only — never split on write.
 */
export function parsePackage(pkg: string | null): { label: string; value: number | null } {
  const raw = (pkg ?? '').trim()
  if (!raw) return { label: '', value: null }

  // Last number with 3+ digits wins — package names rarely contain one, prices always do.
  const matches = raw.match(/[\d][\d,.\s]{2,}/g)
  let value: number | null = null
  let label = raw

  if (matches && matches.length > 0) {
    const last = matches[matches.length - 1]
    const digits = last.replace(/[^\d]/g, '')
    if (digits) {
      const parsed = Number.parseInt(digits, 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        value = parsed
        label = raw
          .slice(0, raw.lastIndexOf(last))
          // Drop a trailing currency token ("Rs", "LKR") and any separator
          // left behind, so "eCommerce – Rs 285,000" labels as "eCommerce".
          .replace(/\b(rs\.?|lkr)\s*$/i, '')
          .replace(/[-–—:·,\s]+$/, '')
          .trim()
      }
    }
  }

  return { label: label || raw, value }
}

/** `phone` is one free-text column that may hold two numbers separated by "/". */
export function splitPhones(phone: string | null): string[] {
  return (phone ?? '')
    .split(/[/|]/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export function joinPhones(phones: string[]): string {
  return phones.map((p) => p.trim()).filter(Boolean).join(' / ')
}

/** `createdby` and `"createdBy"` are both incomplete; neither alone is trustworthy. */
export function resolveCreatedBy(row: Pick<ProspectRow, 'createdby' | 'createdBy'>): string {
  const camel = (row.createdBy ?? '').trim()
  const lower = (row.createdby ?? '').trim()
  return camel || lower || 'Unknown'
}

/* ------------------------------------------------------------------ writes */

export interface AddProspectInput {
  name: string
  /** Already joined with "/" — one free-text column holds both numbers. */
  phone: string
  type: string
  area: string
  pkg: string
  pain: string
  script: string
  assignedto: string
}

/**
 * `id` is `crypto.randomUUID()` — v1 used `Date.now()` and triplicated rows
 * across devices (SPEC §0.9).
 *
 * `created_at` / `updated_at` are the authoritative timestamptz columns on
 * prospects. `createdat` (lowercase) is dead here (0/677) and is deliberately
 * not written; `"createdBy"` is the better-populated of the two author
 * columns, so new rows write that one (SPEC §7).
 */
export function buildProspectRow(
  input: AddProspectInput,
  author: string,
  now: Date = new Date()
): ProspectRow {
  const iso = now.toISOString()
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    type: input.type.trim() || null,
    area: input.area.trim() || null,
    phone: input.phone.trim() || null,
    assignedto: input.assignedto.trim() || null,
    pkg: input.pkg.trim() || null,
    pain: input.pain.trim() || null,
    script: input.script.trim() || null,
    favourite: false,
    created_at: iso,
    updated_at: iso,
    createdby: null,
    createdBy: author,
    deleted_at: null,
  }
}

/** Optimistic insert with rollback. A failure is surfaced, never swallowed (§0.5). */
export function useAddProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ input, author }: { input: AddProspectInput; author: string }) => {
      const row = buildProspectRow(input, author)
      const { data, error, status } = await supabase.from('prospects').insert(row).select().single()
      if (error) throw toSupabaseError(error, status)
      return (data ?? row) as ProspectRow
    },

    onMutate: async ({ input, author }) => {
      await queryClient.cancelQueries({ queryKey: PROSPECTS_QUERY_KEY })
      const previous = queryClient.getQueryData<ProspectRow[]>(PROSPECTS_QUERY_KEY)
      const optimistic = buildProspectRow(input, author)
      queryClient.setQueryData<ProspectRow[]>(PROSPECTS_QUERY_KEY, (old) => [
        optimistic,
        ...(old ?? []),
      ])
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(PROSPECTS_QUERY_KEY, context.previous)
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEY })
    },
  })
}

/**
 * Toggles `prospects.favourite`, a real boolean column v1 already writes.
 *
 * Optimistic so the star flips on the frame the rep taps it — a favourite that
 * lags reads as a dead control. Rolls back on failure and surfaces the status
 * code; never silently reverts (SPEC §0.5). `updated_at` is written because it
 * is the authoritative last-modified column on prospects (677/677, §7).
 */
export function useToggleFavourite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, favourite }: { id: string; favourite: boolean }) => {
      const { data, error, status } = await supabase
        .from('prospects')
        .update({ favourite, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw toSupabaseError(error, status)
      return data as ProspectRow
    },

    onMutate: async ({ id, favourite }) => {
      await queryClient.cancelQueries({ queryKey: PROSPECTS_QUERY_KEY })
      const previous = queryClient.getQueryData<ProspectRow[]>(PROSPECTS_QUERY_KEY)
      queryClient.setQueryData<ProspectRow[]>(PROSPECTS_QUERY_KEY, (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, favourite } : p))
      )
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(PROSPECTS_QUERY_KEY, context.previous)
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEY })
    },
  })
}

/**
 * Reassigns explicit prospect ids to a new `assignedto`. Used by Today's
 * Coverage block, which already knows — via the canonical join — exactly
 * which rows belong to a rep regardless of how their name is spelled. Scoping
 * by `id IN (...)` sidesteps re-matching spellings server-side entirely,
 * which matters because one rep's prospects can carry several raw spellings
 * of `assignedto` (SPEC §0.13) that a single `.eq()` would miss.
 *
 * The detail panel's owner control calls this with a single id rather than
 * having its own mutation: one write path for "who owns this" means one place
 * where the stored spelling is decided. `null` clears the owner — the column is
 * nullable and four production rows are already blank.
 */
export function useBulkReassign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ids, assignedto }: { ids: string[]; assignedto: string | null }) => {
      const { error, status } = await supabase
        .from('prospects')
        .update({ assignedto, updated_at: new Date().toISOString() })
        .in('id', ids)
      if (error) throw toSupabaseError(error, status)
      return { ids, assignedto }
    },

    onMutate: async ({ ids, assignedto }) => {
      await queryClient.cancelQueries({ queryKey: PROSPECTS_QUERY_KEY })
      const previous = queryClient.getQueryData<ProspectRow[]>(PROSPECTS_QUERY_KEY)
      const idSet = new Set(ids)
      queryClient.setQueryData<ProspectRow[]>(PROSPECTS_QUERY_KEY, (old) =>
        (old ?? []).map((p) => (idSet.has(p.id) ? { ...p, assignedto } : p))
      )
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(PROSPECTS_QUERY_KEY, context.previous)
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEY })
    },
  })
}

/* ------------------------------------------------------------------- trash */

/**
 * Both trash writes and the purge have to reach the palette's session-cached
 * search index as well as the main list, or a deleted prospect stays findable
 * in the palette for the rest of the session.
 */
function invalidateProspectReads(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: PROSPECTS_QUERY_KEY })
  void queryClient.invalidateQueries({ queryKey: PALETTE_PROSPECTS_KEY })
}

/**
 * Moves a prospect to the trash by stamping `deleted_at`. Nothing is destroyed:
 * the row keeps its calls, its script and its owner, and [useRestoreProspect]
 * puts it back untouched.
 *
 * Optimistic — the row carries its tombstone in the cache immediately, so it
 * leaves every list and appears in the trash on the same frame. `updated_at` is
 * written alongside because it is the authoritative last-modified column (§7).
 */
export function useSoftDeleteProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const iso = new Date().toISOString()
      const { error, status } = await supabase
        .from('prospects')
        .update({ deleted_at: iso, updated_at: iso })
        .eq('id', id)
      if (error) throw toSupabaseError(error, status)
      return { id, deleted_at: iso }
    },

    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: PROSPECTS_QUERY_KEY })
      const previous = queryClient.getQueryData<ProspectRow[]>(PROSPECTS_QUERY_KEY)
      const iso = new Date().toISOString()
      queryClient.setQueryData<ProspectRow[]>(PROSPECTS_QUERY_KEY, (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, deleted_at: iso } : p))
      )
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(PROSPECTS_QUERY_KEY, context.previous)
    },

    onSuccess: () => invalidateProspectReads(queryClient),
  })
}

/** Clears the tombstone. The row returns to every list exactly as it left. */
export function useRestoreProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error, status } = await supabase
        .from('prospects')
        .update({ deleted_at: null, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw toSupabaseError(error, status)
      return { id }
    },

    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: PROSPECTS_QUERY_KEY })
      const previous = queryClient.getQueryData<ProspectRow[]>(PROSPECTS_QUERY_KEY)
      queryClient.setQueryData<ProspectRow[]>(PROSPECTS_QUERY_KEY, (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, deleted_at: null } : p))
      )
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(PROSPECTS_QUERY_KEY, context.previous)
    },

    onSuccess: () => invalidateProspectReads(queryClient),
  })
}

/**
 * A real `DELETE`. Irreversible, and deliberately not offered anywhere except
 * the trash behind a second confirmation.
 *
 * `calls` joins prospects by name text with no foreign key, so the call history
 * for this business survives this delete and becomes unlinked — it keeps
 * counting on Performance and My Calls while belonging to no prospect row. The
 * confirmation copy has to say so; see TrashPage.
 */
export function usePurgeProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error, status } = await supabase.from('prospects').delete().eq('id', id)
      if (error) throw toSupabaseError(error, status)
      return { id }
    },

    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: PROSPECTS_QUERY_KEY })
      const previous = queryClient.getQueryData<ProspectRow[]>(PROSPECTS_QUERY_KEY)
      queryClient.setQueryData<ProspectRow[]>(PROSPECTS_QUERY_KEY, (old) =>
        (old ?? []).filter((p) => p.id !== id)
      )
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(PROSPECTS_QUERY_KEY, context.previous)
    },

    onSuccess: () => invalidateProspectReads(queryClient),
  })
}
