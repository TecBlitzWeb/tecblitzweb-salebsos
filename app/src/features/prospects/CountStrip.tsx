import clsx from 'clsx'
import type { ProspectCounts } from '../../api/counts'
import { CLEARED_FILTERS, hasActiveFilter, type ProspectFilters } from './useProspectList'

interface CountStripProps {
  counts: ProspectCounts
  filters: ProspectFilters
  onChange: (next: Partial<ProspectFilters>) => void
}

/**
 * Every figure is a filter. Matches v1's behaviour, which was right — the
 * numbers are the fastest way into a filtered view.
 */
export function CountStrip({ counts, filters, onChange }: CountStripProps) {
  // The three narrowing cards are mutually exclusive: each clears the other two
  // so a click always lands on a state the user can read off the strip.
  const items: { label: string; value: number; active: boolean; apply: Partial<ProspectFilters> }[] = [
    {
      label: 'All',
      value: counts.all,
      // Only active when nothing at all narrows the list — including area, type,
      // outcome and search, which the strip itself doesn't set.
      active: !hasActiveFilter(filters),
      apply: CLEARED_FILTERS,
    },
    {
      label: 'Never called',
      value: counts.neverCalled,
      active: filters.neverCalled,
      apply: { neverCalled: !filters.neverCalled, hasFollowUp: false, cold: false },
    },
    {
      label: 'Follow-ups',
      value: counts.hasFollowUp,
      active: filters.hasFollowUp,
      apply: { hasFollowUp: !filters.hasFollowUp, neverCalled: false, cold: false },
    },
    {
      label: 'Cold',
      value: counts.cold,
      active: filters.cold,
      apply: { cold: !filters.cold, neverCalled: false, hasFollowUp: false },
    },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          aria-pressed={item.active}
          onClick={() => onChange(item.apply)}
          className={clsx(
            'focus-ring flex min-h-[44px] flex-1 basis-32 flex-col items-start justify-center rounded-md border px-3 py-2 text-left transition-colors duration-[120ms] motion-reduce:transition-none lg:min-h-0',
            item.active
              ? 'border-brand bg-brand-ghost'
              : 'border-border bg-surface hover:bg-surface-2'
          )}
        >
          <span className="text-2xs text-text-subtle">{item.label}</span>
          <span
            className={clsx(
              'font-display text-xl tabular-nums',
              item.active ? 'text-brand' : 'text-text'
            )}
          >
            {item.value.toLocaleString('en-US')}
          </span>
        </button>
      ))}
    </div>
  )
}
