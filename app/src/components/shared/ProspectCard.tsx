import { MessageCircle, Phone, PlusCircle, Star } from 'lucide-react'
import clsx from 'clsx'
import { TemperatureBar } from './TemperatureBar'
import { StatusChip, type CallOutcome } from './StatusChip'
import { formatCurrency, formatPhone } from '../../lib/format'
import { displayRepName } from '../../lib/repKey'

export interface ProspectCardData {
  id: string
  name: string
  type: string
  area: string
  /** Raw stored value (e.g. `Himanthi2525`) — normalised for display only. */
  assignee: string
  packageName: string
  value: number
  phone: string
  outcome: CallOutcome
  callCount: number
  /** `null` = never called; drives the temperature bar. */
  daysSinceLastCall: number | null
  favourite?: boolean
}

interface ProspectCardProps {
  prospect: ProspectCardData
  onOpen?: (id: string) => void
  onLogCall?: (id: string) => void
  onToggleFavourite?: (id: string) => void
}

/**
 * 44px touch targets on mobile (§10), 32px on desktop (§6a). Colour is what
 * separates them at a glance — three identical grey glyphs are unusable when
 * a rep is mid-call.
 */
const ICON_BUTTON =
  'focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-sm transition-colors duration-[120ms] hover:bg-surface-2 motion-reduce:transition-none lg:h-8 lg:w-8'

export function ProspectCard({
  prospect,
  onOpen,
  onLogCall,
  onToggleFavourite,
}: ProspectCardProps) {
  const {
    id,
    name,
    type,
    area,
    assignee,
    packageName,
    value,
    phone,
    outcome,
    callCount,
    daysSinceLastCall,
    favourite,
  } = prospect

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.(id)
        }
      }}
      className="focus-ring flex h-[88px] cursor-pointer overflow-hidden rounded-md border border-border bg-surface transition-colors duration-[120ms] hover:bg-surface-2 motion-reduce:transition-none"
    >
      <TemperatureBar daysSinceLastCall={daysSinceLastCall} />

      {/* justify-between distributes the three rows across the full 88px */}
      <div className="flex min-w-0 flex-1 flex-col justify-between px-3.5 py-2.5">
        {/* Row 1 — star, business name, package + value */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-pressed={Boolean(favourite)}
            aria-label={favourite ? 'Remove from favourites' : 'Add to favourites'}
            title={favourite ? 'Remove from favourites' : 'Add to favourites'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavourite?.(id)
            }}
            className="focus-ring -m-1 shrink-0 rounded-sm p-1"
          >
            <Star
              size={16}
              strokeWidth={1.75}
              className={favourite ? 'fill-warning text-warning' : 'text-text-subtle'}
            />
          </button>
          <span className="min-w-0 flex-1 truncate text-lg font-medium text-text">{name}</span>
          <span className="shrink-0 whitespace-nowrap text-sm tabular-nums text-text-muted">
            {packageName} · {formatCurrency(value)}
          </span>
        </div>

        {/* Row 2 — type · area · person, then call count and recency */}
        <div className="flex min-w-0 items-center gap-2 text-xs text-text-muted">
          <span className="min-w-0 flex-1 truncate">
            {type} · {area} · {displayRepName(assignee)}
          </span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">
            {callCount} {callCount === 1 ? 'call' : 'calls'} ·{' '}
            {daysSinceLastCall === null ? 'never' : `${daysSinceLastCall}d`}
          </span>
        </div>

        {/* Row 3 — outcome chip, phone, actions */}
        <div className="flex min-w-0 items-center gap-2">
          <StatusChip outcome={outcome} />
          <span className="min-w-0 flex-1 truncate font-mono text-xs tracking-[0.02em] text-text-muted">
            {formatPhone(phone)}
          </span>
          <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <a
              href={`tel:${phone}`}
              title="Call"
              aria-label={`Call ${name}`}
              className={clsx(ICON_BUTTON, 'text-brand')}
            >
              <Phone size={16} strokeWidth={1.75} />
            </a>
            <a
              href={`https://wa.me/${phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp"
              aria-label={`WhatsApp ${name}`}
              className={clsx(ICON_BUTTON, 'text-success')}
            >
              <MessageCircle size={16} strokeWidth={1.75} />
            </a>
            <button
              type="button"
              title="Log call"
              aria-label={`Log call for ${name}`}
              onClick={() => onLogCall?.(id)}
              className={clsx(ICON_BUTTON, 'text-text-muted hover:text-text')}
            >
              <PlusCircle size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
