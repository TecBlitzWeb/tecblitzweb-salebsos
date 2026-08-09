import { format, parseISO, startOfMonth, subDays } from 'date-fns'
import { colomboDateTime } from './format'

export type RangeKey = 'today' | 'week' | 'month' | 'all' | 'custom'

export interface DateRange {
  key: RangeKey
  /** Inclusive Colombo day, `yyyy-MM-dd`. Null means unbounded. */
  start: string | null
  /** Inclusive Colombo day, `yyyy-MM-dd`. Null means unbounded. */
  end: string | null
}

export const RANGE_CHIPS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All' },
  { key: 'custom', label: 'Custom' },
]

/** Today in Asia/Colombo — never UTC, never the browser's zone (SPEC §7). */
export function colomboToday(): string {
  return colomboDateTime().date
}

/**
 * Ranges are expressed as inclusive Colombo *days*, not instants, so a row is
 * tested by converting its timestamp to the Colombo day it happened on and
 * comparing `yyyy-MM-dd` strings. Fixed-width ISO days compare correctly as
 * strings, and this keeps every table — whose timestamps live in three
 * different formats — answering the same question the same way.
 */
export function resolveRange(key: RangeKey, customStart?: string, customEnd?: string): DateRange {
  const today = colomboToday()

  if (key === 'all') return { key, start: null, end: null }
  if (key === 'today') return { key, start: today, end: today }
  if (key === 'week') {
    return { key, start: format(subDays(parseISO(today), 6), 'yyyy-MM-dd'), end: today }
  }
  if (key === 'month') {
    return { key, start: format(startOfMonth(parseISO(today)), 'yyyy-MM-dd'), end: today }
  }
  return {
    key: 'custom',
    start: customStart?.trim() || null,
    end: customEnd?.trim() || null,
  }
}

/** `day` is a Colombo `yyyy-MM-dd`. An unparseable/absent day is never in range. */
export function inRange(day: string | null, range: DateRange): boolean {
  if (day === null) return false
  if (range.start && day < range.start) return false
  if (range.end && day > range.end) return false
  return true
}

/**
 * The Colombo day a real timestamptz landed on. For TEXT date columns use the
 * table's own parser instead — `parseLeadDate` for `interested_leads`, which
 * validates the format rather than inferring it.
 */
export function colomboDayOf(iso: string | null): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return colomboDateTime(new Date(t)).date
}
