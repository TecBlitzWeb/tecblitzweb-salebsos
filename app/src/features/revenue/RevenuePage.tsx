import { useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/shared/EmptyState'
import { ErrorState } from '../../components/shared/ErrorState'
import { DateRangeChips } from '../../components/shared/DateRangeChips'
import { Skeleton } from '../../components/ui/Skeleton'
import { SupabaseError } from '../../lib/queryClient'
import { formatCurrency } from '../../lib/format'
import { displayRepName } from '../../lib/repKey'
import { resolveRange, type RangeKey } from '../../lib/dateRange'
import { toCsv, downloadCsv } from '../../lib/csv'
import { useRevenue } from './useRevenue'

function readError(error: unknown): { message: string; status: number } {
  if (error instanceof SupabaseError) {
    if (error.status === 401) return { message: 'Your session expired. Sign in again.', status: 401 }
    if (error.status === 403) {
      return { message: `You don't have permission to read revenue.`, status: 403 }
    }
    return { message: `Couldn't load revenue. Check your connection.`, status: error.status }
  }
  return { message: `Couldn't load revenue. Check your connection.`, status: 0 }
}

export function RevenuePage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const range = useMemo(
    () => resolveRange(rangeKey, customStart, customEnd),
    [rangeKey, customStart, customEnd]
  )

  const revenue = useRevenue(range)

  function exportCsv() {
    const rows = [
      ['Business', 'Package', 'Value', 'Rep', 'Date', 'Source', 'Recorded at'],
      ...revenue.rows.map((d) => [
        d.biz,
        d.pkg,
        // The real figure, never the price embedded in the package label.
        typeof d.value === 'number' ? d.value : Number(d.value ?? 0),
        displayRepName(d.rep),
        d.date,
        d.source,
        d.created_at,
      ]),
    ]
    downloadCsv(`closed-deals-${range.start ?? 'all'}-to-${range.end ?? 'now'}.csv`, toCsv(rows))
  }

  if (revenue.error) return <ErrorState {...readError(revenue.error)} onRetry={revenue.refetch} />

  if (revenue.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-28 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeChips
          value={rangeKey}
          onChange={setRangeKey}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStart={setCustomStart}
          onCustomEnd={setCustomEnd}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={revenue.rows.length === 0}
          onClick={exportCsv}
        >
          <Download size={16} strokeWidth={1.75} />
          Export CSV
        </Button>
      </div>

      {/*
        The hero. With no deals on record this must never render "Rs 0" — a
        measured zero and an absent measurement look identical, and mistaking
        one for the other is the failure this rebuild exists to correct.
      */}
      <section className="rounded-md border border-border bg-surface p-4">
        <div className="text-2xs text-text-muted">Closed revenue this month</div>
        {revenue.hasAnyDeals ? (
          <div className="font-display text-3xl font-semibold tabular-nums text-text">
            {formatCurrency(revenue.monthRevenue)}
          </div>
        ) : (
          <div className="font-display text-3xl font-semibold text-text-subtle">
            No deals recorded yet
          </div>
        )}

        {/*
          Pace-to-target is deliberately absent: no target exists in the database
          or the specs, and inventing one — or back-fitting it from past
          performance — would stand a fabricated number beside a real one.
        */}
        <p className="mt-1 text-2xs text-text-subtle">
          Pace to target unavailable — no revenue target is stored anywhere yet.
        </p>
      </section>

      {/* Unclosed pipeline, in its own card with dashed brand styling so it reads
          as an estimate and can never be mistaken for closed revenue. */}
      <section className="rounded-md border border-dashed border-brand/40 bg-surface p-4">
        <div className="text-2xs text-text-muted">
          Pipeline value — unclosed estimate, not revenue
        </div>
        <div className="font-display text-2xl font-semibold tabular-nums text-brand/40">
          {formatCurrency(revenue.pipelineValue)}
        </div>
        <p className="mt-1 text-2xs text-text-subtle">
          Estimated from package labels across {revenue.pipelineCount.toLocaleString('en-US')} open{' '}
          {revenue.pipelineCount === 1 ? 'lead' : 'leads'}. Not earned, and never added to closed
          revenue.
        </p>
      </section>

      {!revenue.hasAnyDeals ? (
        <EmptyState message="No deals have been recorded yet, so there is nothing to chart. Marking a lead Won on Interested Leads records the first one." />
      ) : revenue.dealsInRange === 0 ? (
        <EmptyState message="No deals were closed in this range." />
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-lg text-text">Monthly</h2>
            <div className="h-64 w-full rounded-md border border-border bg-surface p-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenue.months}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--color-text-subtle)"
                    tickLine={false}
                    fontSize={11}
                  />
                  <YAxis
                    stroke="var(--color-text-subtle)"
                    tickLine={false}
                    fontSize={11}
                    width={70}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Closed"
                    fill="var(--color-brand)"
                    radius={[3, 3, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name="Cumulative"
                    stroke="var(--color-success)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-lg text-text">Package mix</h2>
            <div className="flex flex-col gap-2">
              {revenue.packages.map((p) => (
                <div
                  key={p.label}
                  className="flex items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-text">{p.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-text-muted">
                    {p.count} {p.count === 1 ? 'deal' : 'deals'}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-text">
                    {formatCurrency(p.value)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-lg text-text">Per-rep contribution</h2>
            <div className="flex flex-col gap-2">
              {revenue.reps.map((r) => (
                <div
                  key={r.key}
                  className="flex items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-text">
                    {displayRepName(r.spelling)}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-text-muted">
                    {r.count} {r.count === 1 ? 'deal' : 'deals'}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-text">
                    {formatCurrency(r.value)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
