import { useQuery } from '@tanstack/react-query'
import { fetchAllRows } from './supabaseQuery'

/**
 * The command palette's search index.
 *
 * Deliberately separate from `useProspects` / `useInterestedLeads` /
 * `useSalesUsers`: those pull every column because their pages render every
 * column, and the palette only ever shows a name and a phone number. Three
 * narrow reads keep the payload small enough to hold for the whole session.
 *
 * Every read goes through `fetchAllRows`. `prospects` is 681 rows against a
 * 500-row PostgREST cap, so a plain `select` would return 500 and make 181
 * prospects silently unfindable — the palette would look like it worked.
 *
 * Reads are RLS-scoped, exactly like every other read in this app: a rep gets
 * their own rows, a CEO gets all of them, and a denial arrives as 200 `[]`.
 * There is no app-side rep filter here and there must not be one.
 */

export interface PaletteProspect {
  id: string
  name: string | null
  phone: string | null
  /** Selected only so trashed rows can be dropped. Never rendered. */
  deleted_at: string | null
}

/** No `lead` column exists on this table — the business name is `biz`. */
export interface PaletteLead {
  id: string
  biz: string | null
  phone: string | null
}

export interface PalettePerson {
  id: number
  name: string | null
  username: string | null
}

/**
 * Fetched once on first open and held for the rest of the session. `staleTime:
 * Infinity` is what stops a keystroke, a refocus or a remount from refetching;
 * the palette filters the cached arrays in memory instead.
 */
const SESSION_CACHE = { staleTime: Infinity, gcTime: Infinity } as const

/**
 * Exported because the trash mutations must invalidate it. This index is held
 * for the whole session (`staleTime: Infinity`), so without that invalidation a
 * prospect deleted after the palette's first open would stay searchable until
 * the page reloaded.
 */
export const PALETTE_PROSPECTS_KEY = ['palette', 'prospects'] as const

export function usePaletteProspects(enabled: boolean) {
  return useQuery({
    queryKey: PALETTE_PROSPECTS_KEY,
    queryFn: () => fetchAllRows<PaletteProspect>('prospects', 'id,name,phone,deleted_at'),
    enabled,
    ...SESSION_CACHE,
    // The trash is not searchable. Same rule as every other prospect read.
    select: (rows: PaletteProspect[]) => rows.filter((row) => !row.deleted_at),
  })
}

export function usePaletteLeads(enabled: boolean) {
  return useQuery({
    queryKey: ['palette', 'interested_leads'],
    queryFn: () => fetchAllRows<PaletteLead>('interested_leads', 'id,biz,phone'),
    enabled,
    ...SESSION_CACHE,
  })
}

/**
 * `sales_users` has a SELECT policy of `true` for every authenticated user, so
 * RLS will *not* hide the roster from a rep. Whether this runs at all is an app
 * decision, and the palette makes it with `canAccessPath(role, '/team')` — the
 * same helper that guards the Team route. `enabled` is that decision arriving
 * here; this hook does not second-guess it, and must never be called with
 * `true` on a weaker check.
 */
export function usePalettePeople(enabled: boolean) {
  return useQuery({
    queryKey: ['palette', 'sales_users'],
    queryFn: () => fetchAllRows<PalettePerson>('sales_users', 'id,name,username'),
    enabled,
    ...SESSION_CACHE,
  })
}
