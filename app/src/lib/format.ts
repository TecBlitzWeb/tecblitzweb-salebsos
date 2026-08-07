import { format, differenceInCalendarDays } from 'date-fns'

/**
 * Every rep is in Sri Lanka, so the human-readable `date`/`time` text columns
 * are always Asia/Colombo wall clock — never the browser's timezone and never
 * UTC. A manager opening the app from abroad must still see and write the same
 * local time the rep on the floor read off their phone.
 *
 * Sri Lanka is UTC+5:30 with no DST, but this resolves through the IANA zone
 * rather than hardcoding the offset, so it stays correct if that ever changes.
 */
export const APP_TIMEZONE = 'Asia/Colombo'

const COLOMBO_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * Splits one instant into the Colombo-local `date` and `time` strings.
 *
 * Both are derived from the *same* instant in the *same* zone. The previous
 * code took `date` from `toISOString()` (UTC) and `time` from `toTimeString()`
 * (machine-local), so across midnight they described different days.
 */
export function colomboDateTime(instant: Date = new Date()): { date: string; time: string } {
  const parts: Record<string, string> = {}
  for (const p of COLOMBO_PARTS.formatToParts(instant)) parts[p.type] = p.value

  // Some engines render midnight as hour "24" under hour12:false.
  const hour = parts.hour === '24' ? '00' : parts.hour

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
  }
}

/** DESIGN_RULES §11: `Rs 65,000`, no decimals, non-breaking space after `Rs`. */
export function formatCurrency(value: number): string {
  return `Rs ${Math.round(value).toLocaleString('en-US')}`
}

/** DESIGN_RULES §11: `01 Aug` in lists. */
export function formatListDate(date: Date): string {
  return format(date, 'dd MMM')
}

/** DESIGN_RULES §11: `1 Aug 2026` in detail views. */
export function formatDetailDate(date: Date): string {
  return format(date, 'd MMM yyyy')
}

/** DESIGN_RULES §11: relative only under 7 days, absolute beyond that. */
export function formatRelativeDate(date: Date, now: Date = new Date()): string {
  const days = differenceInCalendarDays(now, date)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatListDate(date)
}

/** Sri Lankan mobile format: `0XX XXX XXXX`. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 10) return raw
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}
