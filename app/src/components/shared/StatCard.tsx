import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import clsx from 'clsx'

interface StatCardProps {
  label: string
  value: string
  /** Percent or absolute change vs. the same weekday last week (§7 Today). */
  delta?: number
  deltaLabel?: string
  /** §7 Revenue: unclosed value must read weaker than closed. */
  potential?: boolean
  /** One hero stat per page maximum (§2). */
  hero?: boolean
}

export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  potential = false,
  hero = false,
}: StatCardProps) {
  const direction = delta === undefined ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const DeltaIcon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus

  return (
    <div
      className={clsx(
        'rounded-md border bg-surface p-3.5',
        potential ? 'border-dashed border-brand/40' : 'border-border'
      )}
    >
      <div className="text-2xs text-text-muted">{label}</div>
      <div
        className={clsx(
          'font-display font-semibold tabular-nums',
          hero ? 'text-3xl' : 'text-2xl',
          potential ? 'text-brand/40' : 'text-text'
        )}
      >
        {value}
      </div>
      {direction && (
        <div
          className={clsx(
            'mt-0.5 flex items-center gap-1 text-2xs tabular-nums',
            direction === 'up' && 'text-success',
            direction === 'down' && 'text-danger',
            direction === 'flat' && 'text-text-subtle'
          )}
        >
          <DeltaIcon size={16} strokeWidth={1.75} className="h-3 w-3" />
          <span>
            {delta! > 0 ? '+' : ''}
            {delta}
          </span>
          {deltaLabel && <span className="text-text-subtle">{deltaLabel}</span>}
        </div>
      )}
    </div>
  )
}
