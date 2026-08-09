import { useQuery } from '@tanstack/react-query'
import { fetchAllRows } from './supabaseQuery'
import { canonicalRepKey } from '../lib/repKey'

export interface SalesUser {
  id: number
  auth_user_id: string | null
  name: string | null
  username: string | null
  email: string | null
  role: string | null
  created_at: string | null
}

/**
 * The columns `sales_users` actually has, probed against the live table on
 * 10 Aug 2026: id, auth_user_id, name, username, email, role, owned_reps,
 * created_at. There is no `active` / `is_active` / `status` / `deactivated_at`
 * column, which is why nothing in this app offers to deactivate anyone.
 *
 * `owned_reps` is deliberately not selected: no live policy reads it, so
 * pulling it into the client would give it an authority it no longer has.
 */
export const SALES_USER_COLUMNS = 'id, auth_user_id, name, username, email, role, created_at'

/**
 * Roster identity for a `sales_users` row.
 *
 * Username first, name as fallback — this must stay byte-identical with the
 * roster keying in `usePerformance` (see its roster block), or the same person
 * keys two different ways and the Team page's call counts stop matching the
 * Performance page's. Both sides go through [canonicalRepKey] so a stored
 * `Himanthi2525` and a logged `himanthi` land on one key.
 */
export function salesUserKey(user: Pick<SalesUser, 'username' | 'name'>): string {
  return canonicalRepKey(user.username).trim() || canonicalRepKey(user.name).trim()
}

/**
 * RLS-scoped: a Sales rep may see only themselves, so this returns whatever the
 * database allows and the UI adapts. It is never the thing enforcing who can be
 * picked — that decision belongs to RLS on write (SPEC §7).
 *
 * Paged like every other full-table read. Nine rows fit in one page today, but
 * an unpaged `select` is a truncation waiting for the roster to grow.
 */
export function useSalesUsers() {
  return useQuery({
    queryKey: ['sales_users', 'all'],
    queryFn: () => fetchAllRows<SalesUser>('sales_users', SALES_USER_COLUMNS),
    // Team membership changes rarely; no need to refetch on every mount.
    staleTime: 300_000,
  })
}
