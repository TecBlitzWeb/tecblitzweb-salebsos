import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toSupabaseError } from './supabaseQuery'

export interface SalesUser {
  id: number
  name: string | null
  username: string | null
  role: string | null
}

/**
 * RLS-scoped: a Sales rep may see only themselves, so this returns whatever the
 * database allows and the UI adapts. It is never the thing enforcing who can be
 * picked — that decision belongs to RLS on write (SPEC §7).
 */
export function useSalesUsers() {
  return useQuery({
    queryKey: ['sales_users', 'all'],
    queryFn: async (): Promise<SalesUser[]> => {
      const { data, error, status } = await supabase
        .from('sales_users')
        .select('id, name, username, role')
        .order('name', { ascending: true })
      if (error) throw toSupabaseError(error, status)
      return (data ?? []) as SalesUser[]
    },
    // Team membership changes rarely; no need to refetch on every mount.
    staleTime: 300_000,
  })
}
