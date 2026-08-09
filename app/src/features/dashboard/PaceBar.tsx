interface PaceBarProps {
  today: number
  average: number
}

/**
 * Self-comparison only, never a leaderboard (DESIGN_RULES §7, SPEC §5.1) — the
 * only two numbers on this bar both belong to the viewing rep.
 */
export function PaceBar({ today, average }: PaceBarProps) {
  const max = Math.max(today, average, 1)
  const todayPct = Math.min(100, (today / max) * 100)
  const avgPct = Math.min(100, (average / max) * 100)
  const roundedAvg = Math.round(average * 10) / 10

  return (
    <div className="rounded-md border border-border bg-surface p-3.5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-2xs text-text-muted">Today's pace</span>
        <span className="text-2xs tabular-nums text-text-subtle">
          {today} vs your {roundedAvg}/day average
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${todayPct}%` }}
        />
        {/* The average marker — a fixed reference point, not a second bar to compare against anyone else. */}
        <div
          aria-hidden="true"
          className="absolute top-0 h-full w-px bg-text-subtle"
          style={{ left: `${avgPct}%` }}
        />
      </div>
    </div>
  )
}
