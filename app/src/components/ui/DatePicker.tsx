import { useEffect, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { fieldClass } from './Input'
import { formatDetailDate } from '../../lib/format'

interface DatePickerProps {
  id?: string
  value: Date | null
  onChange: (date: Date) => void
  placeholder?: string
  /** §6c/§7: follow-up snoozing needs +1d / +3d / +1w one-tap presets. */
  presets?: boolean
}

const PRESETS: { label: string; days: number }[] = [
  { label: '+1d', days: 1 },
  { label: '+3d', days: 3 },
  { label: '+1w', days: 7 },
]

export function DatePicker({ id, value, onChange, placeholder, presets = true }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(value ?? new Date()))
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const today = new Date()

  function select(date: Date) {
    onChange(date)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={clsx(fieldClass, 'flex items-center justify-between text-left')}
      >
        <span className={value ? 'text-text' : 'text-text-subtle'}>
          {value ? formatDetailDate(value) : (placeholder ?? 'Pick a date')}
        </span>
        <CalendarDays size={16} strokeWidth={1.75} className="shrink-0 text-text-subtle" />
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute z-20 mt-1 w-[280px] rounded-md border border-border bg-surface-3 p-3 shadow-2"
        >
          {presets && (
            <div className="mb-3 flex gap-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => select(addDays(today, preset.days))}
                  className="focus-ring h-6 rounded-sm border border-border-strong px-2 text-xs text-text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text motion-reduce:transition-none"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(addMonths(month, -1))}
              className="focus-ring flex h-7 w-7 items-center justify-center rounded-sm text-text-muted hover:bg-surface-2 hover:text-text"
            >
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>
            <span className="text-sm text-text">{format(month, 'MMMM yyyy')}</span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(addMonths(month, 1))}
              className="focus-ring flex h-7 w-7 items-center justify-center rounded-sm text-text-muted hover:bg-surface-2 hover:text-text"
            >
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={`${d}${i}`} className="pb-1 text-center text-2xs text-text-subtle">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const outside = !isSameMonth(day, month)
              const selected = value != null && isSameDay(day, value)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => select(day)}
                  className={clsx(
                    'focus-ring flex h-8 items-center justify-center rounded-sm text-sm tabular-nums transition-colors duration-[120ms] motion-reduce:transition-none',
                    selected && 'bg-brand text-on-brand',
                    !selected && outside && 'text-text-subtle hover:bg-surface-2',
                    !selected && !outside && 'text-text hover:bg-surface-2',
                    !selected && isSameDay(day, today) && 'border border-border-strong'
                  )}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
