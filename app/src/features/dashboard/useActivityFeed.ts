import { useMemo } from 'react'
import { useCalls, timeOf } from '../../api/calls'
import type { CallRow } from '../../types/db'

const FEED_SIZE = 15

/**
 * Last 15 calls in visible scope (SPEC §5.1). "Visible scope" is whatever
 * `useCalls()` returns — RLS decides which rows a session can read, so there
 * is no client-side role filtering here (SPEC §7: an RLS denial arrives as
 * 200/`[]`, never a silent truncation the client would have to re-apply).
 */
export function useActivityFeed() {
  const calls = useCalls()

  const items = useMemo<CallRow[]>(() => {
    return [...(calls.data ?? [])]
      .sort((a, b) => timeOf(b.createdat) - timeOf(a.createdat))
      .slice(0, FEED_SIZE)
  }, [calls.data])

  return {
    items,
    isLoading: calls.isLoading,
    error: calls.error ?? null,
    refetch: () => void calls.refetch(),
  }
}
