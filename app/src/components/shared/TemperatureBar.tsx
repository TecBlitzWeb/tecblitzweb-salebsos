import clsx from 'clsx'
import { temperatureMeta } from '../../lib/temperature'

interface TemperatureBarProps {
  /** `null` = never called. */
  daysSinceLastCall: number | null
  className?: string
}

/**
 * The signature element (DESIGN_RULES §1). A 3px left edge bar encoding days
 * since last contact — the only place the five temperature colours appear
 * together. Decorative: the tier is always also stated in text nearby, so it
 * is hidden from assistive tech rather than announced as a colour.
 */
export function TemperatureBar({ daysSinceLastCall, className }: TemperatureBarProps) {
  const meta = temperatureMeta(daysSinceLastCall)
  return (
    <div
      aria-hidden="true"
      className={clsx('w-[3px] shrink-0 self-stretch', meta.barClass, className)}
    />
  )
}
