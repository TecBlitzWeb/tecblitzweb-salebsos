import { Search } from 'lucide-react'
import { FilterChip } from '../../components/shared/FilterChip'
import { Select } from '../../components/ui/Select'
import type { AssigneeTally, ProspectCounts } from '../../api/counts'
import { displayRepName } from '../../lib/repKey'
import { CLEARED_FILTERS, type ProspectFilters, type ProspectSort } from './useProspectList'

interface ProspectFilterBarProps {
  filters: ProspectFilters
  counts: ProspectCounts
  onChange: (next: Partial<ProspectFilters>) => void
}

const SORTS: { value: ProspectSort; label: string }[] = [
  { value: 'coldest', label: 'Coldest first' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name' },
]

function topKeys(map: Map<string, number>, limit = 40): string[] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k)
}

/**
 * One option per person. The option *value* is the canonical key, so selecting
 * "Himanthi" filters every spelling at once; the *label* comes from that
 * person's most common raw spelling (SPEC §0.13).
 */
function assigneeOptions(map: Map<string, AssigneeTally>, limit = 40) {
  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((t) => ({ value: t.key, label: `${displayRepName(t.spelling)} (${t.count})` }))
}

/**
 * A single always-visible row of removable chips (DESIGN_RULES §7). Active
 * filters are never hidden behind a dropdown, so nobody has to wonder why the
 * count changed.
 */
export function ProspectFilterBar({ filters, counts, onChange }: ProspectFilterBarProps) {
  const active: { key: string; label: string; clear: Partial<ProspectFilters> }[] = []

  if (filters.assignee) {
    active.push({
      key: 'assignee',
      label: displayRepName(filters.assignee),
      clear: { assignee: null },
    })
  }
  if (filters.area) active.push({ key: 'area', label: filters.area, clear: { area: null } })
  if (filters.type) active.push({ key: 'type', label: filters.type, clear: { type: null } })
  if (filters.outcome) active.push({ key: 'outcome', label: filters.outcome, clear: { outcome: null } })
  if (filters.neverCalled) {
    active.push({ key: 'never', label: 'Never called', clear: { neverCalled: false } })
  }
  if (filters.hasFollowUp) {
    active.push({ key: 'followup', label: 'Has follow-up', clear: { hasFollowUp: false } })
  }
  if (filters.cold) active.push({ key: 'cold', label: 'Cold', clear: { cold: false } })
  if (filters.search) {
    active.push({ key: 'search', label: `"${filters.search}"`, clear: { search: '' } })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
          />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Search name, area, type, phone…"
            aria-label="Search prospects"
            className="focus-ring h-9 w-full rounded-sm border border-border-strong bg-surface pl-8 pr-3 text-base text-text outline-none"
          />
        </div>

        <Select
          aria-label="Assignee"
          placeholder="Everyone"
          options={assigneeOptions(counts.byAssignee)}
          value={filters.assignee ?? ''}
          onChange={(e) => onChange({ assignee: e.target.value || null })}
          className="w-auto min-w-36"
        />

        <Select
          aria-label="Area"
          placeholder="All areas"
          options={topKeys(counts.byArea).map((a) => ({ value: a, label: a }))}
          value={filters.area ?? ''}
          onChange={(e) => onChange({ area: e.target.value || null })}
          className="w-auto min-w-32"
        />

        <Select
          aria-label="Type"
          placeholder="All types"
          options={topKeys(counts.byType).map((t) => ({ value: t, label: t }))}
          value={filters.type ?? ''}
          onChange={(e) => onChange({ type: e.target.value || null })}
          className="w-auto min-w-32"
        />

        <Select
          aria-label="Sort"
          options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as ProspectSort })}
          className="w-auto min-w-36"
        />
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((chip) => (
            <FilterChip key={chip.key} label={chip.label} onRemove={() => onChange(chip.clear)} />
          ))}
          <button
            type="button"
            onClick={() => onChange(CLEARED_FILTERS)}
            className="focus-ring rounded-sm px-2 py-1 text-xs text-text-muted hover:text-text"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
