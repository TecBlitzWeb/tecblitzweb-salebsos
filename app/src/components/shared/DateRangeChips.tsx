import { FilterChip } from './FilterChip'
import { Input } from '../ui/Input'
import { RANGE_CHIPS, type RangeKey } from '../../lib/dateRange'

interface DateRangeChipsProps {
  value: RangeKey
  onChange: (key: RangeKey) => void
  customStart: string
  customEnd: string
  onCustomStart: (v: string) => void
  onCustomEnd: (v: string) => void
}

/** Today · Week · Month · All · Custom (DESIGN_RULES §7 Performance). */
export function DateRangeChips({
  value,
  onChange,
  customStart,
  customEnd,
  onCustomStart,
  onCustomEnd,
}: DateRangeChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {RANGE_CHIPS.map((chip) => (
        <FilterChip
          key={chip.key}
          label={chip.label}
          active={value === chip.key}
          onClick={() => onChange(chip.key)}
        />
      ))}

      {value === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="Range start"
            value={customStart}
            onChange={(e) => onCustomStart(e.target.value)}
            className="h-8 w-auto text-xs"
          />
          <span className="text-xs text-text-subtle">to</span>
          <Input
            type="date"
            aria-label="Range end"
            value={customEnd}
            onChange={(e) => onCustomEnd(e.target.value)}
            className="h-8 w-auto text-xs"
          />
        </div>
      )}
    </div>
  )
}
