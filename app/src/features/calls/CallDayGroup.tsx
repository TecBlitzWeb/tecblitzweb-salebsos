import clsx from 'clsx'
import type { CallRow } from '../../types/db'
import { StatusChip } from '../../components/shared/StatusChip'
import { OUTCOME_META } from '../../components/shared/StatusChip'
import { CANONICAL_OUTCOMES, OUTCOME_TO_CHIP, type CanonicalOutcome } from '../../api/outcomes'
import { displayRepName } from '../../lib/repKey'
import { toOutcome } from '../prospects/ProspectRow'

/** 4px stacked bar showing the day's outcome mix (§7). */
function OutcomeMix({ calls }: { calls: CallRow[] }) {
  const total = calls.length || 1
  return (
    <div className="flex h-1 w-24 overflow-hidden rounded-full bg-surface-2">
      {CANONICAL_OUTCOMES.map((o) => {
        const n = calls.filter((c) => c.outcome === o).length
        if (n === 0) return null
        const chip = OUTCOME_TO_CHIP[o]
        return (
          <div
            key={o}
            title={`${o}: ${n}`}
            className={OUTCOME_META[chip].dotClass}
            style={{ width: `${(n / total) * 100}%` }}
          />
        )
      })}
    </div>
  )
}

interface CallDayGroupProps {
  day: string
  calls: CallRow[]
  editingId: string | null
  onStartEdit: (id: string) => void
  onCancelEdit: () => void
  onPickOutcome: (id: string, outcome: CanonicalOutcome) => void
  /** Returns false when `calls.prospect` matches no prospects.name — an orphan. */
  isLinked: (call: CallRow) => boolean
  onOpenProspect: (call: CallRow) => void
}

export function CallDayGroup({
  day,
  calls,
  editingId,
  onStartEdit,
  onCancelEdit,
  onPickOutcome,
  isLinked,
  onOpenProspect,
}: CallDayGroupProps) {
  return (
    <section>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-bg py-2">
        <h2 className="font-display text-lg text-text">{day}</h2>
        <span className="text-xs tabular-nums text-text-muted">
          {calls.length} {calls.length === 1 ? 'call' : 'calls'}
        </span>
        <OutcomeMix calls={calls} />
      </header>

      <ul className="flex flex-col gap-2 py-2">
        {calls.map((call) => {
          const linked = isLinked(call)
          return (
          <li
            key={call.id}
            // Only linked rows are clickable. An orphan has no prospect to open,
            // so it stays inert and says so rather than looking dead.
            role={linked ? 'button' : undefined}
            tabIndex={linked ? 0 : undefined}
            onClick={linked ? () => onOpenProspect(call) : undefined}
            onKeyDown={
              linked
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpenProspect(call)
                    }
                  }
                : undefined
            }
            className={clsx(
              'flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-surface px-3 py-2 transition-colors duration-[120ms] motion-reduce:transition-none',
              linked
                ? 'focus-ring cursor-pointer border-border hover:bg-surface-2'
                : 'border-warning/30'
            )}
          >
            <span className="min-w-0 flex-1 truncate text-sm text-text">
              {call.prospect || 'Unknown business'}
            </span>
            {!linked && (
              <span
                title="This call's business name matches no prospect, so it is invisible on the Prospects page"
                className="shrink-0 rounded-sm bg-warning/12 px-1.5 py-0.5 text-2xs font-medium text-warning"
              >
                Unlinked
              </span>
            )}
            <span className="shrink-0 font-mono text-xs tabular-nums text-text-subtle">
              {call.time || '—'}
            </span>
            <span className="shrink-0 text-xs text-text-muted">{displayRepName(call.rep)}</span>

            {editingId === call.id ? (
              // stopPropagation: these sit inside a now-clickable row, and a
              // click here must change the outcome, not open the slide-over.
              <div
                className="flex w-full flex-wrap gap-1 pt-1"
                onClick={(e) => e.stopPropagation()}
              >
                {CANONICAL_OUTCOMES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => onPickOutcome(call.id, o)}
                    className={clsx(
                      'focus-ring rounded-sm border px-2 py-1 text-xs transition-colors duration-[120ms] motion-reduce:transition-none',
                      call.outcome === o
                        ? 'border-brand bg-brand-ghost text-brand'
                        : 'border-border-strong text-text hover:bg-surface-2'
                    )}
                  >
                    {o}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="focus-ring rounded-sm px-2 py-1 text-xs text-text-muted hover:text-text"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onStartEdit(call.id)
                }}
                title="Change outcome"
                className="focus-ring shrink-0 rounded-sm"
              >
                <StatusChip outcome={toOutcome(call.outcome)} />
              </button>
            )}

            {call.notes && (
              <p className="w-full truncate text-xs text-text-muted">{call.notes}</p>
            )}
          </li>
          )
        })}
      </ul>
    </section>
  )
}
