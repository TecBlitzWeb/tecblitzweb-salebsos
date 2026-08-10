import { MessageCircle, Phone, PlusCircle } from 'lucide-react'
import clsx from 'clsx'
import { TemperatureBar } from '../../components/shared/TemperatureBar'
import { toPhoneLink } from '../../lib/phone'
import type { ActionItem } from './useActionQueue'

/** Mirrors ProspectRow's icon-button treatment (SPEC §7 shares one visual language). */
const ICON_BUTTON =
  'focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-sm transition-colors duration-[120ms] hover:bg-surface-2 motion-reduce:transition-none lg:h-8 lg:w-8'

interface ActionRowProps {
  item: ActionItem
  onOpen: () => void
  onLogCall: () => void
}

/**
 * One Call/WhatsApp pair for a single number. Disabled when there is no number
 * at all, and equally when the stored value is too short to dial.
 */
function NumberActions({ name, phone }: { name: string; phone: string | null }) {
  const link = phone ? toPhoneLink(phone) : null
  if (!link) {
    const reason = phone ? 'Phone number on record is incomplete' : 'No phone number on record'
    return (
      <>
        <button
          type="button"
          disabled
          title={reason}
          aria-label={`Call — ${reason.toLowerCase()}`}
          className={clsx(ICON_BUTTON, 'cursor-not-allowed text-text-subtle opacity-40')}
        >
          <Phone size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          disabled
          title={reason}
          aria-label={`WhatsApp — ${reason.toLowerCase()}`}
          className={clsx(ICON_BUTTON, 'cursor-not-allowed text-text-subtle opacity-40')}
        >
          <MessageCircle size={16} strokeWidth={1.75} />
        </button>
      </>
    )
  }

  return (
    <>
      <a
        href={`tel:${link.tel}`}
        title="Call"
        aria-label={`Call ${name} on ${link.raw}`}
        className={clsx(ICON_BUTTON, 'text-brand')}
      >
        <Phone size={16} strokeWidth={1.75} />
      </a>
      <a
        href={`https://wa.me/${link.whatsapp}`}
        target="_blank"
        rel="noopener noreferrer"
        title="WhatsApp"
        aria-label={`WhatsApp ${name} on ${link.raw}`}
        className={clsx(ICON_BUTTON, 'text-success')}
      >
        <MessageCircle size={16} strokeWidth={1.75} />
      </a>
    </>
  )
}

/** One row of the action queue — the hero of Today (DESIGN_RULES §7). */
export function ActionRow({ item, onOpen, onLogCall }: ActionRowProps) {
  const days = item.prospect?.daysSinceLastCall ?? null
  // A row with two numbers offers both — never silently pick one (SPEC §0.7 phone handling).
  const phones = item.phones.length > 0 ? item.phones : [null]

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
      className="focus-ring flex min-h-[72px] cursor-pointer overflow-hidden rounded-md border border-border bg-surface transition-colors duration-[120ms] hover:bg-surface-2 motion-reduce:transition-none"
    >
      <TemperatureBar daysSinceLastCall={days} />

      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3.5 py-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-base font-medium text-text">{item.name}</span>
          <span
            className={clsx(
              'text-2xs',
              item.kind === 'overdue' && 'text-danger',
              item.kind === 'due-today' && 'text-brand',
              item.kind === 'never-called' && 'text-text-muted'
            )}
          >
            {item.reasonLabel}
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
          {phones.map((phone, i) => (
            <div key={phone ?? i} className="flex shrink-0 items-center gap-2">
              <NumberActions name={item.name} phone={phone} />
              {i === 0 && (
                <button
                  type="button"
                  title="Log call"
                  aria-label={`Log call for ${item.name}`}
                  onClick={onLogCall}
                  className={clsx(ICON_BUTTON, 'text-text-muted hover:text-text')}
                >
                  <PlusCircle size={16} strokeWidth={1.75} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
