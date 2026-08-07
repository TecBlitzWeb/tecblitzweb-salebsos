import { MessageCircle, Phone, PlusCircle, Star } from 'lucide-react'
import clsx from 'clsx'
import { TemperatureBar } from '../../components/shared/TemperatureBar'
import { StatusChip, type CallOutcome } from '../../components/shared/StatusChip'
import { formatCurrency, formatPhone } from '../../lib/format'
import { displayRepName } from '../../lib/repKey'
import type { ProspectView } from './useProspectList'

/** Maps free-text `calls.outcome` onto the six chips in DESIGN_RULES §4. */
export function toOutcome(raw: string | null): CallOutcome {
  const v = (raw ?? '').toLowerCase()
  if (!v) return 'new'
  if (v.includes('interest') && !v.includes('not')) return 'interested'
  if (v.includes('follow')) return 'followup'
  if (v.includes('whats') || v.includes('wa ')) return 'whatsapp'
  if (v.includes('not interest') || v.includes('reject')) return 'not-interested'
  if (v.includes('no ans') || v.includes('noans') || v.includes('missed')) return 'no-answer'
  return 'new'
}

const ICON_BUTTON =
  'focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-sm transition-colors duration-[120ms] hover:bg-surface-2 motion-reduce:transition-none lg:h-8 lg:w-8'

interface ProspectRowProps {
  view: ProspectView
  onOpen: () => void
  onLogCall: () => void
  onToggleFavourite: () => void
}

export function ProspectRow({ view, onOpen, onLogCall, onToggleFavourite }: ProspectRowProps) {
  const { row, packageLabel, packageValue, phones, callCount, daysSinceLastCall } = view
  const primary = phones[0] ?? ''
  const favourite = Boolean(row.favourite)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="focus-ring flex h-[88px] cursor-pointer overflow-hidden rounded-md border border-border bg-surface transition-colors duration-[120ms] hover:bg-surface-2 motion-reduce:transition-none"
    >
      <TemperatureBar daysSinceLastCall={daysSinceLastCall} />

      <div className="flex min-w-0 flex-1 flex-col justify-between px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-pressed={favourite}
            aria-label={favourite ? 'Remove from favourites' : 'Add to favourites'}
            title={favourite ? 'Remove from favourites' : 'Add to favourites'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavourite()
            }}
            className="focus-ring -m-1 shrink-0 rounded-sm p-1"
          >
            <Star
              size={16}
              strokeWidth={1.75}
              className={favourite ? 'fill-warning text-warning' : 'text-text-subtle'}
            />
          </button>
          <span className="min-w-0 flex-1 truncate text-lg font-medium text-text">
            {row.name || 'Unnamed'}
          </span>
          {(packageLabel || packageValue !== null) && (
            <span className="shrink-0 whitespace-nowrap text-sm tabular-nums text-text-muted">
              {packageLabel}
              {packageValue !== null && `${packageLabel ? ' · ' : ''}${formatCurrency(packageValue)}`}
            </span>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2 text-xs text-text-muted">
          <span className="min-w-0 flex-1 truncate">
            {[row.type, row.area, displayRepName(row.assignedto)].filter(Boolean).join(' · ')}
            {view.duplicateName && (
              <span className="ml-1 text-warning" title="Another prospect shares this name — call history may be shared">
                · duplicate name
              </span>
            )}
          </span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">
            {callCount} {callCount === 1 ? 'call' : 'calls'} ·{' '}
            {daysSinceLastCall === null ? 'never' : `${daysSinceLastCall}d`}
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <StatusChip outcome={toOutcome(view.latestOutcome)} />
          <span className="min-w-0 flex-1 truncate font-mono text-xs tracking-[0.02em] text-text-muted">
            {primary ? formatPhone(primary) : '—'}
          </span>
          <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {/*
              With no phone these render as <button disabled> rather than an
              inert <a>: a disabled control announces itself to screen readers
              and shows a not-allowed cursor, where `pointer-events-none` just
              swallowed the click silently.
            */}
            {primary ? (
              <a
                href={`tel:${primary}`}
                title="Call"
                aria-label={`Call ${row.name ?? 'prospect'}`}
                className={clsx(ICON_BUTTON, 'text-brand')}
              >
                <Phone size={16} strokeWidth={1.75} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="No phone number on record"
                aria-label="Call — no phone number on record"
                className={clsx(ICON_BUTTON, 'cursor-not-allowed text-text-subtle opacity-40')}
              >
                <Phone size={16} strokeWidth={1.75} />
              </button>
            )}

            {primary ? (
              <a
                href={`https://wa.me/${primary.replace(/\D/g, '')}`}
                target="_blank"
                // noopener/noreferrer is required with target="_blank" — without
                // it the opened tab can reach back via window.opener.
                rel="noopener noreferrer"
                title="WhatsApp"
                aria-label={`WhatsApp ${row.name ?? 'prospect'}`}
                className={clsx(ICON_BUTTON, 'text-success')}
              >
                <MessageCircle size={16} strokeWidth={1.75} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="No phone number on record"
                aria-label="WhatsApp — no phone number on record"
                className={clsx(ICON_BUTTON, 'cursor-not-allowed text-text-subtle opacity-40')}
              >
                <MessageCircle size={16} strokeWidth={1.75} />
              </button>
            )}

            <button
              type="button"
              title="Log call"
              aria-label={`Log call for ${row.name ?? 'prospect'}`}
              onClick={onLogCall}
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
