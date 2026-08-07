import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/shared/EmptyState'
import { ErrorState } from '../../components/shared/ErrorState'
import { ProspectCardSkeleton } from '../../components/ui/Skeleton'
import { useProspectCounts } from '../../api/counts'
import { useToggleFavourite } from '../../api/prospects'
import { describeWriteError } from '../../api/writeError'
import type { CanonicalOutcome } from '../../api/outcomes'
import { useToast } from '../../components/ui/Toast'
import { LogCallSheet } from '../calls/LogCallSheet'
import { SupabaseError } from '../../lib/queryClient'
import { useAuth } from '../../auth/useAuth'
import { CountStrip } from './CountStrip'
import { ProspectFilterBar } from './ProspectFilterBar'
import { ProspectVirtualList } from './ProspectVirtualList'
import { ProspectDetail } from './ProspectDetail'
import { ProspectSheet } from './ProspectSheet'
import {
  CLEARED_FILTERS,
  DEFAULT_FILTERS,
  hasActiveFilter,
  useProspectList,
  type ProspectFilters,
  type ProspectView,
} from './useProspectList'

/**
 * Errors are surfaced three different ways (SPEC §7):
 *   401 → auth failure; queryClient already refreshed and signed out if needed
 *   403 → permission denied (Postgres 42501)
 *   anything else → transport/server failure, retryable
 * An RLS denial on read is *not* an error — it arrives as 200 `[]` and shows
 * the empty state. We never render "no data" when the cause was a failure.
 */
function describeError(error: unknown): { message: string; status: number } {
  if (error instanceof SupabaseError) {
    if (error.status === 401) {
      return { message: 'Your session expired. Sign in again to keep working.', status: 401 }
    }
    if (error.status === 403) {
      return {
        message: `You don't have permission to read prospects. Ask a CEO to check your role.`,
        status: 403,
      }
    }
    return { message: `Couldn't load prospects. Check your connection.`, status: error.status }
  }
  return { message: `Couldn't load prospects. Check your connection.`, status: 0 }
}

export function ProspectsPage() {
  const { repKey } = useAuth()
  const { showToast } = useToast()
  const toggleFavourite = useToggleFavourite()
  const [filters, setFilters] = useState<ProspectFilters>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<ProspectView | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // One LogCallSheet for the whole page — the row icon, the slide-over's two
  // buttons and its empty-timeline action all drive this same instance.
  const [logCall, setLogCall] = useState<{
    prospect: string
    phone: string
    outcome: CanonicalOutcome | null
  } | null>(null)

  function openLogCall(view: ProspectView, outcome?: CanonicalOutcome) {
    setLogCall({
      prospect: view.row.name ?? '',
      phone: view.phones[0] ?? '',
      outcome: outcome ?? null,
    })
  }

  async function onToggleFavourite(view: ProspectView) {
    const next = !view.row.favourite
    try {
      await toggleFavourite.mutateAsync({ id: view.row.id, favourite: next })
    } catch (error) {
      showToast({
        message: describeWriteError(error, next ? 'add this favourite' : 'remove this favourite'),
        tone: 'error',
      })
    }
  }

  const { views, isLoading, error, refetch } = useProspectList(filters)
  const { counts } = useProspectCounts(repKey)

  const areas = useMemo(() => [...counts.byArea.keys()].sort(), [counts.byArea])

  function change(next: Partial<ProspectFilters>) {
    setFilters((prev) => ({ ...prev, ...next }))
  }

  const filtersActive = hasActiveFilter(filters)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {filtersActive ? (
            <>
              Showing{' '}
              <span className="tabular-nums text-text">{views.length.toLocaleString('en-US')}</span>{' '}
              of <span className="tabular-nums">{counts.all.toLocaleString('en-US')}</span>{' '}
              {counts.all === 1 ? 'prospect' : 'prospects'}
              <span className="ml-1 text-brand">· filtered</span>
            </>
          ) : (
            <>
              <span className="tabular-nums text-text">{counts.all.toLocaleString('en-US')}</span>{' '}
              {counts.all === 1 ? 'prospect' : 'prospects'}
            </>
          )}
        </p>
        <Button size="default" variant="primary" onClick={() => setSheetOpen(true)}>
          <Plus size={16} strokeWidth={1.75} />
          Add prospect
        </Button>
      </div>

      <CountStrip counts={counts} filters={filters} onChange={change} />
      <ProspectFilterBar filters={filters} counts={counts} onChange={change} />

      {error ? (
        <ErrorState {...describeError(error)} onRetry={refetch} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProspectCardSkeleton key={i} />
          ))}
        </div>
      ) : views.length === 0 ? (
        filtersActive ? (
          <EmptyState
            message="No prospects match these filters."
            action={
              <Button size="default" variant="secondary" onClick={() => change(CLEARED_FILTERS)}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            message="No prospects yet."
            action={
              <Button size="default" variant="primary" onClick={() => setSheetOpen(true)}>
                Add prospect
              </Button>
            }
          />
        )
      ) : (
        <ProspectVirtualList
          views={views}
          onOpen={setSelected}
          onLogCall={openLogCall}
          onToggleFavourite={(v) => void onToggleFavourite(v)}
        />
      )}

      <ProspectDetail view={selected} onClose={() => setSelected(null)} onLogCall={openLogCall} />

      <LogCallSheet
        open={logCall !== null}
        onClose={() => setLogCall(null)}
        defaultProspect={logCall?.prospect ?? ''}
        defaultPhone={logCall?.phone ?? ''}
        defaultOutcome={logCall?.outcome ?? null}
      />
      <ProspectSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        views={views}
        areas={areas}
        onOpenExisting={(v) => {
          setSheetOpen(false)
          setSelected(v)
        }}
      />
    </div>
  )
}
