import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { fieldClass } from './Input'

interface ComboboxProps {
  id?: string
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Areas and business types are free-text in the DB, so this defaults on. */
  allowCustom?: boolean
}

/**
 * Filter-as-you-type over known values, but never blocks a new one — the DB
 * columns this feeds are free text and reps will always have a new area name.
 */
export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder,
  allowCustom = true,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => option.toLowerCase().includes(q))
  }, [options, value])

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && matches[activeIndex]) {
      e.preventDefault()
      onChange(matches[activeIndex])
      setOpen(false)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActiveIndex(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={clsx(fieldClass, 'pr-8')}
      />
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
      />

      {open && (matches.length > 0 || (allowCustom && value.trim())) && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-sm border border-border bg-surface-3 py-1 shadow-2"
        >
          {matches.map((option, i) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
                className={clsx(
                  'flex h-8 w-full items-center px-3 text-left text-sm',
                  i === activeIndex ? 'bg-surface-2 text-text' : 'text-text-muted'
                )}
              >
                {option}
              </button>
            </li>
          ))}
          {allowCustom && value.trim() && !matches.includes(value.trim()) && (
            <li>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-full items-center px-3 text-left text-sm text-text-subtle"
              >
                Use “{value.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
