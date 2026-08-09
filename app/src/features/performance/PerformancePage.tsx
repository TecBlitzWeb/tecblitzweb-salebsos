import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ErrorState } from '../../components/shared/ErrorState'
import { EmptyState } from '../../components/shared/EmptyState'
import { DateRangeChips } from '../../components/shared/DateRangeChips'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { SupabaseError } from '../../lib/queryClient'
import { formatCurrency } from '../../lib/format'
import { displayRepName } from '../../lib/repKey'
import { resolveRange, type RangeKey } from '../../lib/dateRange'
import { usePerformance, type RepPerformance } from './usePerformance'

function readError(error: unknown): { message: string; status: number } {
  if (error instanceof SupabaseError) {
    if (error.status === 401) return { message: 'Your session expired. Sign in again.', status: 401 }
    if (error.status === 403) {
      return { message: `You don't have permission to read performance.`, status: 403 }
    }
    return { message: `Couldn't load performance. Check your connection.`, status: error.status }
  }
  return { message: `Couldn't load performance. Check your connection.`, status: 0 }
}

/** A rate with no denominator is unknown, not zero. */
function pct(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`
}

/** Calls per day. Flat when the rep logged nothing — never a missing element. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-2xs text-text-subtle">—</span>

  const max = Math.max(...values, 1)
  const step = 100 / (values.length - 1)
  const points = values.map((v, i) => `${i * step},${20 - (v / max) * 18}`).join(' ')
  const silent = values.every((v) => v === 0)

  return (
    <svg
      viewBox="0 0 100 20"
      preserveAspectRatio="none"
      className="h-5 w-20"
      role="img"
      aria-label={`Calls per day, peak ${max}`}
    >
      <polyline
        points={points}
        fill="none"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        className={silent ? 'stroke-text-subtle' : 'stroke-brand'}
      />
    </svg>
  )
}

function RepRow({ rep, hasAnyDeals }: { rep: RepPerformance; hasAnyDeals: boolean }) {
  // Greyed, never removed: a rep who did nothing is a finding, not an absence.
  const silent = rep.calls === 0

  return (
    <tr className={clsx('border-b border-border last:border-b-0', silent && 'text-text-subtle')}>
      <td className="px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={clsx('truncate', silent ? 'text-text-subtle' : 'text-text')}>
            {displayRepName(rep.spelling)}
          </span>
          {rep.role && (
            <span className="shrink-0 rounded-sm bg-text-subtle/12 px-1.5 py-0.5 text-2xs text-text-muted">
              {rep.role}
            </span>
          )}
          {rep.offRoster && (
            <span
              title="Appears in the data but not in sales_users"
              className="shrink-0 rounded-sm bg-warning/15 px-1.5 py-0.5 text-2xs text-warning"
            >
              Not on roster
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{rep.calls.toLocaleString('en-US')}</td>
      <td className="px-3 py-2 text-right tabular-nums">{pct(rep.connectRate)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{pct(rep.interestedRate)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{pct(rep.closeRate)}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {/*
          An em dash, not Rs 0. With closed_deals empty, a zero here would read
          as a measured figure rather than an absent one.
        */}
        {rep.revenue === null ? (
          <span
            className="text-text-subtle"
            title={hasAnyDeals ? 'No deals for this rep in range' : 'No deals recorded yet'}
          >
            —
          </span>
        ) : (
          formatCurrency(rep.revenue)
        )}
      </td>
      <td className="px-3 py-2">
        <Sparkline values={rep.trend} />
      </td>
    </tr>
  )
}

export function PerformancePage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const range = useMemo(
    () => resolveRange(rangeKey, customStart, customEnd),
    [rangeKey, customStart, customEnd]
  )

  const {
    reps,
    funnel,
    hasAnyDeals,
    leadParseFailures,
    unrecognisedOutcomes,
    interestedReconciliation,
    isLoading,
    error,
    refetch,
  } = usePerformance(range)

  if (error) return <ErrorState {...readError(error)} onRetry={refetch} />

  return (
    <div className="flex flex-col gap-6">
      <DateRangeChips
        value={rangeKey}
        onChange={setRangeKey}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStart={setCustomStart}
        onCustomEnd={setCustomEnd}
      />

      {leadParseFailures > 0 && (
        <p role="alert" className="rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {leadParseFailures} lead {leadParseFailures === 1 ? 'row has' : 'rows have'} an unreadable
          date and {leadParseFailures === 1 ? 'is' : 'are'} excluded from interested and close rates.
        </p>
      )}

      {/*
        Two tables that should agree and don't. Shown all-time rather than
        range-scoped so it stays put instead of flickering as rows cross the
        range boundary.
      */}
      {interestedReconciliation.gap !== 0 && (
        <p
          role="alert"
          className="rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          {interestedReconciliation.interestedCalls.toLocaleString('en-US')} calls are marked
          Interested but only {interestedReconciliation.leads.toLocaleString('en-US')} leads exist —{' '}
          <strong className="tabular-nums">{Math.abs(interestedReconciliation.gap)}</strong>{' '}
          {interestedReconciliation.gap > 0
            ? `interested ${Math.abs(interestedReconciliation.gap) === 1 ? 'call' : 'calls'} never created a lead.`
            : `more leads than interested calls, so some leads came from somewhere else.`}{' '}
          Interested and close rates count leads, so those calls are not represented. All-time,
          independent of the range above.
        </p>
      )}

      {unrecognisedOutcomes.length > 0 && (
        <p
          role="alert"
          className="rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          Outcomes outside the five known values are excluded from connect rate rather than being
          guessed either way:{' '}
          {unrecognisedOutcomes.map((o, i) => (
            <span key={o.outcome}>
              {i > 0 && ', '}
              <span className="font-mono">{o.outcome}</span> ({o.count})
            </span>
          ))}
          .
        </p>
      )}

      {isLoading ? (
        <TableSkeleton rows={6} columns={7} />
      ) : reps.length === 0 ? (
        <EmptyState message="No reps found. Nobody is listed in sales_users and no calls carry a rep." />
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-text">Per rep</h2>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-2xs uppercase tracking-wide text-text-muted">
                  <th className="px-3 py-2 text-left font-medium">Rep</th>
                  <th className="px-3 py-2 text-right font-medium">Calls</th>
                  <th className="px-3 py-2 text-right font-medium">Connect</th>
                  <th className="px-3 py-2 text-right font-medium">Interested</th>
                  <th className="px-3 py-2 text-right font-medium">Close</th>
                  <th className="px-3 py-2 text-right font-medium">Revenue</th>
                  <th className="px-3 py-2 text-left font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((rep) => (
                  <RepRow key={rep.key} rep={rep} hasAnyDeals={hasAnyDeals} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-2xs text-text-subtle">
            Every role is listed, including CEO and Co-CEO. Connect = Follow-up needed, Not
            interested and Interested, over those plus No answer and WhatsApp sent — someone who
            answered and said no was still reached; a WhatsApp send reached nobody. Interested =
            leads created ÷ calls. Close = deals ÷ leads created.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg text-text">Activity counts</h2>
        <div className="flex flex-col gap-2">
          {funnel.map((step) => (
            <div
              key={step.label}
              className="flex items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-text">{step.label}</span>
              <span className="shrink-0 text-sm tabular-nums text-text">
                {step.count.toLocaleString('en-US')}
              </span>
            </div>
          ))}
        </div>
        {/*
          No percentages between these rows. Each counts a different population,
          none is a subset of the one above, so a rate between them would assert
          a relationship the data does not contain.
        */}
        <p className="text-2xs text-text-subtle">
          Four independent counts, not a funnel — each measures a different population, so no
          conversion rate between them would be meaningful. Each counts events inside the selected
          range by its own timestamp: prospects by when they were added, calls by when they were
          logged. A prospect added before the range but called inside it appears under Called and
          not under Prospects added.
        </p>
      </section>
    </div>
  )
}
