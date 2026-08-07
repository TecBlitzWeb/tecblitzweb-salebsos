import { useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import clsx from 'clsx'
import type { ProspectRow } from '../../types/db'
import { fieldClass } from '../ui/Input'
import { displayRepName } from '../../lib/repKey'

interface ProspectPickerProps {
  id?: string
  prospects: ProspectRow[]
  value: ProspectRow | null
  onChange: (prospect: ProspectRow | null) => void
  autoFocus?: boolean
}

const MAX_RESULTS = 8

/**
 * A real constraint, not a suggestion list.
 *
 * The only way to produce a value is to select an option, and the value is a
 * `ProspectRow` — so an invalid business name is *unrepresentable*, not merely
 * rejected. A `<datalist>` cannot do this: it decorates a free-text input and
 * silently accepts anything typed, which is how calls with `prospect="43"`
 * reached the database (SPEC §0.7).
 *
 * The query text is local to this component and never escapes it.
 */
export function ProspectPicker({
  id,
  prospects,
  value,
  onChange,
  autoFocus,
}: ProspectPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const blurTimer = useRef<number | undefined>(undefined)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return prospects.slice(0, MAX_RESULTS)
    return prospects
      .filter((p) => (p.name ?? '').toLowerCase().includes(q))
      .slice(0, MAX_RESULTS)
  }, [query, prospects])

  function select(p: ProspectRow) {
    onChange(p)
    setQuery('')
    setOpen(false)
    setHighlight(0)
  }

  // Selected state: a removable chip, not editable text. There is no input to
  // type into while a prospect is chosen, so it cannot be edited into garbage.
  if (value) {
    return (
      <div className="flex min-h-9 items-center gap-2 rounded-sm border border-border-strong bg-surface px-2 py-1">
        <span className="min-w-0 flex-1 truncate text-base text-text">{value.name}</span>
        {value.assignedto && (
          <span className="shrink-0 text-2xs text-text-subtle">
            {displayRepName(value.assignedto)}
          </span>
        )}
        <button
          type="button"
          aria-label={`Clear selected business ${value.name ?? ''}`}
          title="Change business"
          onClick={() => onChange(null)}
          className="focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-text-muted hover:bg-surface-2 hover:text-text"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search
        size={16}
        strokeWidth={1.75}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
      />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="prospect-picker-list"
        autoFocus={autoFocus}
        value={query}
        placeholder="Search prospects…"
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a mousedown on an option still registers.
          blurTimer.current = window.setTimeout(() => setOpen(false), 120)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setHighlight(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === 'Enter') {
            // Enter selects the highlighted option. It never commits raw text.
            e.preventDefault()
            const pick = results[highlight]
            if (pick) select(pick)
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        className={clsx(fieldClass, 'pl-8')}
      />

      {open && (
        <ul
          id="prospect-picker-list"
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface-3 py-1 shadow-2"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text-subtle">
              No prospect matches “{query.trim()}”.
            </li>
          ) : (
            results.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  // mousedown fires before blur, so the option survives the blur race.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    window.clearTimeout(blurTimer.current)
                    select(p)
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={clsx(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    i === highlight ? 'bg-brand-ghost text-brand' : 'text-text hover:bg-surface-2'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 text-2xs text-text-subtle">
                    {[p.area, displayRepName(p.assignedto)].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
