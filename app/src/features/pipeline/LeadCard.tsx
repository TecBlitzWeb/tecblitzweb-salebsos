import { MessageCircle, Phone } from 'lucide-react'
import clsx from 'clsx'
import { TemperatureBar } from '../../components/shared/TemperatureBar'
import { Button } from '../../components/ui/Button'
import { toPhoneLink } from '../../lib/phone'
import { formatCurrency } from '../../lib/format'
import { displayRepName } from '../../lib/repKey'
import { PIPELINE_STAGES, type LeadView } from './usePipeline'

const ICON_BUTTON =
  'focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-sm transition-colors duration-[120ms] hover:bg-surface-2 motion-reduce:transition-none lg:h-8 lg:w-8'

/** Terminal stages: the deal is already closed, so Won/Lost would be noise. */
const TERMINAL = new Set(['won', 'lost'])

/**
 * `mockupUrl` is free text any authenticated rep can write, and it lands in an
 * `href`. Anything other than http(s) — `javascript:` above all — is refused
 * rather than rendered, so a stored string cannot become script execution.
 */
function safeHttpUrl(raw: string | null): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

interface LeadCardProps {
  view: LeadView
  onWon: () => void
  onLost: () => void
  onMove: (stage: string) => void
  moving?: boolean
  /** Ringed after being jumped to from search, so the eye lands on it. */
  highlighted?: boolean
}

/** One Call/WhatsApp pair for a single number. Disabled when there is no number. */
function NumberActions({ name, phone }: { name: string; phone: string | null }) {
  if (!phone) {
    return (
      <>
        <button
          type="button"
          disabled
          title="No phone number on record"
          aria-label="Call — no phone number on record"
          className={clsx(ICON_BUTTON, 'cursor-not-allowed text-text-subtle opacity-40')}
        >
          <Phone size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          disabled
          title="No phone number on record"
          aria-label="WhatsApp — no phone number on record"
          className={clsx(ICON_BUTTON, 'cursor-not-allowed text-text-subtle opacity-40')}
        >
          <MessageCircle size={16} strokeWidth={1.75} />
        </button>
      </>
    )
  }

  const link = toPhoneLink(phone)
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

/**
 * One pipeline card (DESIGN_RULES §7): temperature bar · business · rep ·
 * package · value · days-in-stage · phone buttons, with Won and Lost always on
 * the card rather than behind a menu. v1 had no way to close a deal at all and
 * recorded Rs 0 for its entire life — these two buttons are that fix.
 */
export function LeadCard({
  view,
  onWon,
  onLost,
  onMove,
  moving = false,
  highlighted = false,
}: LeadCardProps) {
  const { row, packageLabel, packageValue, phones, daysInStage, closedValue, stage } = view
  const name = row.biz || 'Unnamed'
  const isTerminal = TERMINAL.has(stage)
  const mockupHref = safeHttpUrl(row.mockupUrl)
  // A row with two numbers offers both — never silently pick one.
  const numbers = phones.length > 0 ? phones : [null]

  return (
    <div
      className={clsx(
        'flex overflow-hidden rounded-md border bg-surface',
        highlighted ? 'border-brand ring-1 ring-brand' : 'border-border'
      )}
    >
      <TemperatureBar daysSinceLastCall={view.daysSinceLastCall} />

      <div className="flex min-w-0 flex-1 flex-col gap-2 px-3.5 py-2.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-base font-medium text-text">{name}</span>
          <span className="shrink-0 whitespace-nowrap text-2xs tabular-nums text-text-subtle">
            {daysInStage === null ? '—' : `${daysInStage}d in stage`}
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-2 text-xs text-text-muted">
          <span className="min-w-0 flex-1 truncate">
            {[displayRepName(row.rep), row.bizType, packageLabel].filter(Boolean).join(' · ') || '—'}
          </span>
          {/*
            Closed revenue and pipeline estimate must never read as the same
            number (DESIGN_RULES §7 Revenue). A won card shows what was actually
            recorded; an open card shows the package estimate, dimmed.
          */}
          {isTerminal ? (
            closedValue !== null && (
              <span className="shrink-0 whitespace-nowrap tabular-nums text-text">
                {formatCurrency(closedValue)}
              </span>
            )
          ) : (
            packageValue !== null && (
              <span
                title="Estimated from the package — not recorded revenue"
                className="shrink-0 whitespace-nowrap tabular-nums text-brand/40"
              >
                {formatCurrency(packageValue)}
              </span>
            )
          )}
        </div>

        {stage === 'won' && closedValue === null && (
          <p className="text-2xs text-warning">Won, but no deal was ever recorded.</p>
        )}

        {/* The mockup is what this stage is about, so the link belongs here and
            nowhere else. Refused unless it is a real http(s) URL. */}
        {stage === 'pending' &&
          (mockupHref ? (
            <a
              href={mockupHref}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring truncate text-2xs text-brand underline underline-offset-2"
            >
              View mockup
            </a>
          ) : (
            (row.mockupUrl ?? '').trim() !== '' && (
              <span className="text-2xs text-warning">Mockup link is not a usable web address.</span>
            )
          ))}

        {/* Only on Callback — on any other stage this duplicates the column. */}
        {stage === 'called' && (row.callbackOutcome ?? '').trim() !== '' && (
          <p className="truncate text-2xs text-text-subtle">
            Callback outcome: {row.callbackOutcome}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {numbers.map((phone, i) => (
            <div key={phone ?? i} className="flex shrink-0 items-center gap-1">
              <NumberActions name={name} phone={phone} />
            </div>
          ))}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {!isTerminal && (
              <>
                <Button size="sm" variant="primary" disabled={moving} onClick={onWon}>
                  Won
                </Button>
                <Button size="sm" variant="destructive" disabled={moving} onClick={onLost}>
                  Lost
                </Button>
              </>
            )}

            {/*
              The stage control is a native select on every viewport rather than
              drag-and-drop: touch drag is explicitly forbidden, and a select is
              the same affordance a keyboard and a screen reader already know.
            */}
            <select
              aria-label={`Move ${name} to another stage`}
              disabled={moving}
              value={stage}
              onChange={(e) => {
                const next = e.target.value
                if (next && next !== stage) onMove(next)
              }}
              className="focus-ring h-8 shrink-0 rounded-sm border border-border-strong bg-surface px-2 text-xs text-text disabled:opacity-50"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
              {/* Keeps an unrecognised stored value visible instead of silently
                  showing the card as something it is not. */}
              {!PIPELINE_STAGES.some((s) => s.key === stage) && (
                <option value={stage}>{view.rawStatus || 'Unrecognised'}</option>
              )}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
