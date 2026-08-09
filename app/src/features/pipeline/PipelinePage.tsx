import { useState } from 'react'
import clsx from 'clsx'
import { EmptyState } from '../../components/shared/EmptyState'
import { ErrorState } from '../../components/shared/ErrorState'
import { FilterChip } from '../../components/shared/FilterChip'
import { VirtualList } from '../../components/shared/VirtualList'
import { Skeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { SupabaseError } from '../../lib/queryClient'
import { formatCurrency } from '../../lib/format'
import { displayRepName } from '../../lib/repKey'
import { describeWriteError } from '../../api/writeError'
import { useUpdateLeadStage } from '../../api/leads'
import { LeadCard } from './LeadCard'
import { WonSheet } from './WonSheet'
import { LostSheet } from './LostSheet'
import { usePipeline, UNKNOWN_STAGE, type LeadView, type StageTotal } from './usePipeline'

/** Starting estimate only — cards grow with their optional rows and are measured. */
const CARD_HEIGHT = 124

function readError(error: unknown): { message: string; status: number } {
  if (error instanceof SupabaseError) {
    if (error.status === 401) return { message: 'Your session expired. Sign in again.', status: 401 }
    if (error.status === 403) {
      return { message: `You don't have permission to read the pipeline.`, status: 403 }
    }
    return { message: `Couldn't load the pipeline. Check your connection.`, status: error.status }
  }
  return { message: `Couldn't load the pipeline. Check your connection.`, status: 0 }
}

/** Stage name, count and total value — DESIGN_RULES §7. */
function ColumnHeader({ total }: { total: StageTotal }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="truncate font-display text-base text-text">{total.label}</h2>
        <span className="shrink-0 text-xs tabular-nums text-text-muted">{total.count}</span>
      </div>
      {/*
        Unclosed value is dimmed and labelled. DESIGN_RULES §7 Revenue: pipeline
        value is never presented as though it were closed revenue — conflating
        the two is how a business thinks it made Rs 21M when it made Rs 0.
      */}
      <span
        title={total.estimated ? 'Unclosed — estimated from packages' : 'Recorded revenue'}
        className={clsx(
          'shrink-0 whitespace-nowrap text-xs tabular-nums',
          total.estimated ? 'text-brand/40' : 'text-text'
        )}
      >
        {formatCurrency(total.value)}
      </span>
    </div>
  )
}

export function PipelinePage() {
  const { showToast } = useToast()
  const updateStage = useUpdateLeadStage()

  const [repFilter, setRepFilter] = useState<string | null>(null)
  const [wonTarget, setWonTarget] = useState<LeadView | null>(null)
  const [lostTarget, setLostTarget] = useState<LeadView | null>(null)

  const { byStage, totals, reps, total, isLoading, error, refetch } = usePipeline(repFilter)

  // Mobile only: which stage tab is showing. Desktop renders every column.
  const [activeStage, setActiveStage] = useState<string>('new')

  async function move(view: LeadView, stage: string) {
    // Won and Lost carry required extra information, so they open their sheets
    // rather than moving the card silently.
    if (stage === 'won') {
      setWonTarget(view)
      return
    }
    if (stage === 'lost') {
      setLostTarget(view)
      return
    }
    try {
      await updateStage.mutateAsync({ id: view.row.id, status: stage })
      showToast({ message: 'Stage updated', tone: 'success' })
    } catch (err) {
      showToast({ message: describeWriteError(err, 'move this lead'), tone: 'error' })
    }
  }

  function renderCards(stageKey: string) {
    const cards = byStage.get(stageKey) ?? []
    const label = totals.find((t) => t.key === stageKey)?.label ?? stageKey

    if (cards.length === 0) {
      return <p className="py-3 text-sm text-text-subtle">Nothing in {label}.</p>
    }

    // Virtualized through the same component Prospects uses: 175 of 196 leads
    // sit in New, and mounting them all would stall a phone on first paint.
    return (
      <VirtualList
        items={cards}
        getItemKey={(view) => view.row.id}
        estimateSize={CARD_HEIGHT}
        className="max-h-[calc(100vh-22rem)] min-h-48"
      >
        {(view) => (
          <LeadCard
            view={view}
            moving={updateStage.isPending}
            onWon={() => setWonTarget(view)}
            onLost={() => setLostTarget(view)}
            onMove={(stage) => void move(view, stage)}
          />
        )}
      </VirtualList>
    )
  }

  if (error) return <ErrorState {...readError(error)} onRetry={refetch} />

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-md" />
        ))}
      </div>
    )
  }

  const visibleTotals = totals.filter((t) => t.key !== UNKNOWN_STAGE || t.count > 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-text-muted">
          <span className="tabular-nums text-text">{total.toLocaleString('en-US')}</span>{' '}
          {total === 1 ? 'lead' : 'leads'}
        </p>
      </div>

      {reps.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="Everyone"
            active={repFilter === null}
            onClick={() => setRepFilter(null)}
          />
          {reps.map((r) => (
            <FilterChip
              key={r.key}
              label={displayRepName(r.spelling)}
              count={r.count}
              active={repFilter === r.key}
              onClick={() => setRepFilter(repFilter === r.key ? null : r.key)}
            />
          ))}
        </div>
      )}

      {total === 0 ? (
        <EmptyState
          message={repFilter ? 'No leads for this person.' : 'No interested leads yet.'}
        />
      ) : (
        <>
          {/* Desktop: kanban. Columns scroll horizontally rather than shrinking
              past the point a card is readable. */}
          <div className="hidden gap-4 overflow-x-auto pb-2 lg:flex">
            {visibleTotals.map((t) => (
              <section key={t.key} className="flex w-[300px] shrink-0 flex-col gap-2">
                <ColumnHeader total={t} />
                {renderCards(t.key)}
              </section>
            ))}
          </div>

          {/* Mobile: horizontal stage tabs over a vertical list. No drag-and-drop
              on touch — the card's stage select does the moving. */}
          <div className="flex flex-col gap-3 lg:hidden">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {visibleTotals.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={activeStage === t.key}
                  onClick={() => setActiveStage(t.key)}
                  className={clsx(
                    'focus-ring flex h-8 shrink-0 items-center gap-1.5 rounded-sm border px-2.5 text-xs transition-colors duration-[120ms] motion-reduce:transition-none',
                    activeStage === t.key
                      ? 'border-brand/40 bg-brand-ghost text-brand'
                      : 'border-border-strong text-text-muted'
                  )}
                >
                  {t.label}
                  <span className="tabular-nums opacity-70">{t.count}</span>
                </button>
              ))}
            </div>

            {visibleTotals
              .filter((t) => t.key === activeStage)
              .map((t) => (
                <section key={t.key} className="flex flex-col gap-2">
                  <ColumnHeader total={t} />
                  {renderCards(t.key)}
                </section>
              ))}
          </div>
        </>
      )}

      <WonSheet view={wonTarget} onClose={() => setWonTarget(null)} />
      <LostSheet view={lostTarget} onClose={() => setLostTarget(null)} />
    </div>
  )
}
