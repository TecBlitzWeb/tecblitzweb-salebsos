import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { supabase } from './supabase'

/**
 * PostgrestError never carries an HTTP status — postgrest-js returns it as a
 * sibling field on the response, not on the error object. Every api/*.ts
 * queryFn must throw this instead of the raw error so retry/onError below can
 * branch on status.
 */
export class SupabaseError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'SupabaseError'
    this.status = status
    this.code = code
  }
}

let refreshInFlight: Promise<boolean> | null = null

function refreshSessionOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = supabase.auth
      .refreshSession()
      .then(({ data, error }) => !error && !!data.session)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

async function handleAuthError(error: unknown) {
  if (!(error instanceof SupabaseError) || error.status !== 401) return
  const refreshed = await refreshSessionOnce()
  if (!refreshed) await supabase.auth.signOut()
}

function retryPolicy(failureCount: number, error: unknown): boolean {
  if (error instanceof SupabaseError) {
    if (error.status === 403) return false
    if (error.status === 401) return failureCount < 1
  }
  return failureCount < 2
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: retryPolicy,
    },
    mutations: {
      // Never auto-retry a write. A failed mutation surfaces a toast with the
      // status code and waits for the next explicit user action.
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => void handleAuthError(error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => void handleAuthError(error),
  }),
})
