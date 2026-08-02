import { format, differenceInCalendarDays } from 'date-fns'

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
