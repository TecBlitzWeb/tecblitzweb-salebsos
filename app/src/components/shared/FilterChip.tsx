import { X } from 'lucide-react'
import clsx from 'clsx'

interface FilterChipProps {
  label: string
  count?: number
  active?: boolean
  onRemove?: () => void
  onClick?: () => void
}

/**
 * §7 Prospects: active filters stay visible as removable chips so nobody
 * wonders why the count changed. 24px rather than the §4 status-chip 20px —
 * this one is interactive and carries a hit target.
 */
export function FilterChip({ label, count, active = false, onRemove, onClick }: FilterChipProps) {
  return (
    <span
      className={clsx(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-sm border pl-2 text-xs transition-colors duration-[120ms] motion-reduce:transition-none',
        onRemove ? 'pr-1' : 'pr-2',
        active
          ? 'border-brand/40 bg-brand-ghost text-brand'
          : 'border-border-strong text-text-muted'
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="focus-ring rounded-sm disabled:cursor-default"
      >
        {label}
        {count !== undefined && <span className="ml-1 tabular-nums opacity-70">{count}</span>}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} filter`}
          className="focus-ring flex h-4 w-4 items-center justify-center rounded-sm hover:text-text"
        >
          <X size={16} strokeWidth={1.75} className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
