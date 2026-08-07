import { useCallback, useMemo, useState, useEffect } from 'react'
import { Plus, Search } from 'lucide-react'
import { FilterChip } from '../../components/shared/FilterChip'
import { ProspectDetail } from '../prospects/ProspectDetail'
import { useProspectViews, type ProspectView } from '../prospects/useProspectList'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { EmptyState } from '../../components/shared/EmptyState'
import { ErrorState } from '../../components/shared/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../auth/useAuth'
import { SupabaseError } from '../../lib/queryClient'
import { canonicalRepKey } from '../../lib/repKey'
import { formatRelativeDate } from '../../lib/format'
import { callJoinKey, timeOf, useCalls, useUpdateCallOutcome } from '../../api/calls'
import { useProspects } from '../../api/prospects'
import { CANONICAL_OUTCOMES, type CanonicalOutcome } from '../../api/outcomes'
import { describeWriteError } from '../../api/writeError'
import { CallDayGroup } from './CallDayGroup'
import { LogCallSheet } from './LogCallSheet'
import type { CallRow } from '../../types/db'

function readError(error: unknown): { message: string; status: number } {
  if (error instanceof SupabaseError) {
    if (error.status === 401) return { message: 'Your session expired. Sign in again.', status: 401 }
    if (error.status === 403) {
      return { message: `You don't have permission to read calls.`, status: 403 }
    }
    return { message: `Couldn't load calls. Check your connection.`, status: error.status }
  }
  return { message: `Couldn't load calls. Check your connection.`, status: 0 }
}

export function MyCallsPage() {
  const { repKey } = useAuth()
  const { showToast } = useToast()
  const calls = useCalls()
  const prospects = useProspects()
  // Shared join so a business name resolves to the same prospect here as on
  // the Prospects page — two implementations would eventually disagree.
  const { byJoinKey } = useProspectViews()
  const updateOutcome = useUpdateCallOutcome()

  const [mineOnly, setMineOnly] = useState(true)
  const [outcomeFilter, setOutcomeFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [unlinkedOnly, setUnlinkedOnly] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<ProspectView | null>(null)
  // When set, the sheet opens bound to this prospect instead of showing a picker.
  const [logTarget, setLogTarget] = useState<{ prospect: string; phone: string } | null>(null)

  // `C` opens the log sheet on desktop (§7).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      const typing = el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
      if (!typing && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        setSheetOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /**
   * A call is "linked" when its free-text `prospect` resolves to a real
   * prospects.name. `calls.prospect` has no foreign key, so v1 has been able to
   * write arbitrary names since launch — orphans are pre-existing production
   * data, not just test rows, and nothing surfaced them before now (SPEC §0.7).
   */
  const isLinked = useCallback(
    (call: CallRow) => byJoinKey.has(callJoinKey(call.prospect)),
    [byJoinKey]
  )

  const unlinkedCount = useMemo(() => {
    if (!calls.data || prospects.isLoading) return 0
    return calls.data.filter((c) => !isLinked(c)).length
  }, [calls.data, prospects.isLoading, isLinked])

  const groups = useMemo(() => {
    const rows = calls.data ?? []
    const q = search.trim().toLowerCase()
    const filtered = rows.filter((c) => {
      if (mineOnly && repKey && canonicalRepKey(c.rep).trim() !== repKey.trim()) return false
      if (outcomeFilter && c.outcome !== outcomeFilter) return false
      if (unlinkedOnly && isLinked(c)) return false
      if (q) {
        // Canonical rep folded in alongside the raw spelling, so searching the
        // displayed name matches a call stored as "Himanthi2525" (SPEC §0.13).
        const haystack = [c.prospect, c.rep, canonicalRepKey(c.rep), c.notes]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    // Group by the authoritative timestamp, newest day first.
    const byDay = new Map<string, CallRow[]>()
    for (const call of filtered) {
      const t = timeOf(call.createdat)
      const key = t ? new Date(t).toISOString().slice(0, 10) : 'unknown'
      const bucket = byDay.get(key)
      if (bucket) bucket.push(call)
      else byDay.set(key, [call])
    }

    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, items]) => ({
        day,
        label: day === 'unknown' ? 'Undated' : formatRelativeDate(new Date(day)),
        calls: items.sort((a, b) => timeOf(b.createdat) - timeOf(a.createdat)),
      }))
  }, [calls.data, mineOnly, outcomeFilter, unlinkedOnly, search, repKey, isLinked])

  const total = groups.reduce((n, g) => n + g.calls.length, 0)

  // Selectable prospects for the picker, sorted by name.
  const pickerProspects = useMemo(
    () =>
      [...(prospects.data ?? [])]
        .filter((p) => (p.name ?? '').trim())
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [prospects.data]
  )

  function openProspectFor(call: CallRow) {
    const view = byJoinKey.get(callJoinKey(call.prospect))
    if (view) setSelected(view)
  }

  async function pickOutcome(id: string, outcome: CanonicalOutcome) {
    setEditingId(null)
    try {
      await updateOutcome.mutateAsync({ id, outcome })
      showToast({ message: 'Outcome updated', tone: 'success' })
    } catch (error) {
      showToast({ message: describeWriteError(error, 'update this outcome'), tone: 'error' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-text-muted">
          <span className="tabular-nums text-text">{total.toLocaleString('en-US')}</span>{' '}
          {total === 1 ? 'call' : 'calls'}
        </p>

        <div className="relative min-w-0 flex-1 basis-56">
          <Search
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business, person, notes…"
            aria-label="Search calls"
            className="focus-ring h-9 w-full rounded-sm border border-border-strong bg-surface pl-8 pr-3 text-base text-text outline-none"
          />
        </div>

        <Select
          aria-label="Whose calls"
          options={[
            { value: 'mine', label: 'My calls' },
            { value: 'all', label: 'Everyone' },
          ]}
          value={mineOnly ? 'mine' : 'all'}
          onChange={(e) => setMineOnly(e.target.value === 'mine')}
          className="w-auto min-w-32"
        />
        <Select
          aria-label="Outcome"
          placeholder="All outcomes"
          options={CANONICAL_OUTCOMES.map((o) => ({ value: o, label: o }))}
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="w-auto min-w-40"
        />
        <Button variant="primary" onClick={() => setSheetOpen(true)}>
          <Plus size={16} strokeWidth={1.75} />
          Log call
        </Button>
      </div>

      {/*
        Orphaned calls are otherwise completely invisible — they never appear on
        any prospect, so their history is lost. Surfacing the count is the first
        step to repairing them.
      */}
      {unlinkedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="Unlinked"
            count={unlinkedCount}
            active={unlinkedOnly}
            onClick={() => setUnlinkedOnly((v) => !v)}
            onRemove={unlinkedOnly ? () => setUnlinkedOnly(false) : undefined}
          />
          <span className="text-2xs text-text-subtle">
            {unlinkedCount === 1 ? 'This call' : 'These calls'} name a business that matches no
            prospect, so {unlinkedCount === 1 ? 'it is' : 'they are'} invisible on Prospects.
          </span>
        </div>
      )}

      {calls.error ? (
        <ErrorState {...readError(calls.error)} onRetry={() => void calls.refetch()} />
      ) : calls.isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState
          message={
            mineOnly || outcomeFilter
              ? 'No calls match these filters.'
              : 'No calls logged yet.'
          }
          action={
            <Button variant="primary" onClick={() => setSheetOpen(true)}>
              Log a call
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <CallDayGroup
              key={g.day}
              day={g.label}
              calls={g.calls}
              editingId={editingId}
              onStartEdit={setEditingId}
              onCancelEdit={() => setEditingId(null)}
              onPickOutcome={(id, o) => void pickOutcome(id, o)}
              isLinked={isLinked}
              onOpenProspect={openProspectFor}
            />
          ))}
        </div>
      )}

      <ProspectDetail
        view={selected}
        onClose={() => setSelected(null)}
        onLogCall={(v) => {
          setSelected(null)
          setLogTarget({ prospect: v.row.name ?? '', phone: v.phones[0] ?? '' })
        }}
      />

      {/* FAB on mobile, above the tab bar (§7). Desktop uses the header button + `C`. */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label="Log call"
        className="focus-ring fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-2 lg:hidden"
      >
        <Plus size={20} strokeWidth={1.75} />
      </button>

      {/*
        The only standalone entry point, so it's the only place the business is
        chosen rather than inherited. It's a picker over real prospects.name
        values — never free text (SPEC §0.7).
      */}
      <LogCallSheet
        open={sheetOpen || logTarget !== null}
        onClose={() => {
          setSheetOpen(false)
          setLogTarget(null)
        }}
        defaultProspect={logTarget?.prospect ?? ''}
        defaultPhone={logTarget?.phone ?? ''}
        prospects={pickerProspects}
      />
    </div>
  )
}
