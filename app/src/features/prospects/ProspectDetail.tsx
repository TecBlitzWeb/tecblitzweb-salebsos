import { useMemo, useState } from 'react'
import { Copy, Maximize2, MessageCircle, Phone } from 'lucide-react'
import { SlideOver } from '../../components/ui/SlideOver'
import { ScriptReader } from './ScriptReader'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Field } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { Timeline, type TimelineEntry } from '../../components/shared/Timeline'
import { EmptyState } from '../../components/shared/EmptyState'
import { formatDetailDate, formatPhone } from '../../lib/format'
import { toPhoneLink } from '../../lib/phone'
import { canonicalRepKey, displayRepName } from '../../lib/repKey'
import { useAuth } from '../../auth/useAuth'
import { assignedtoSpelling, salesUserKey, useSalesUsers } from '../../api/users'
import { describeWriteError } from '../../api/writeError'
import { resolveCreatedBy, useBulkReassign } from '../../api/prospects'
import { timeOf } from '../../api/calls'
import { NEEDS_FOLLOWUP, type CanonicalOutcome } from '../../api/outcomes'
import { toOutcome } from './ProspectRow'
import type { ProspectView } from './useProspectList'

interface ProspectDetailProps {
  view: ProspectView | null
  onClose: () => void
  /** Opens the shared LogCallSheet, optionally straight into the follow-up flow. */
  onLogCall: (view: ProspectView, outcome?: CanonicalOutcome) => void
}

/** Sentinel for the "no owner" option — `assignedto` is nullable and four production rows are blank. */
const UNASSIGNED = '__unassigned__'

export function ProspectDetail({ view, onClose, onLogCall }: ProspectDetailProps) {
  const [scriptOpen, setScriptOpen] = useState(false)
  const [readerOpen, setReaderOpen] = useState(false)
  const { role } = useAuth()
  const salesUsers = useSalesUsers()
  const reassign = useBulkReassign()
  const { showToast } = useToast()

  // §6c step 7: CEO and Co-CEO choose an owner; a rep never sees the control.
  const canAssign = role === 'CEO' || role === 'Co-CEO'

  /*
    Options are keyed by canonical identity, not by the stored spelling, so the
    select can match a row holding `avishka` to the roster's `Avishka` without a
    second lookup. The value written on change is resolved through
    [assignedtoSpelling] — never the option key, which is lowercased.
  */
  const ownerOptions = useMemo(() => {
    const options = [{ value: UNASSIGNED, label: 'Unassigned' }]
    for (const user of salesUsers.data ?? []) {
      const key = salesUserKey(user)
      if (!key) continue
      options.push({ value: key, label: user.name?.trim() || displayRepName(user.username) })
    }
    return options
  }, [salesUsers.data])

  const currentKey = canonicalRepKey(view?.row.assignedto).trim() || UNASSIGNED

  /*
    A stored owner who is not on the roster (an offboarded rep still on their
    rows) would otherwise leave the native select showing the first option and
    silently misreport who owns this prospect. Naming them keeps the control
    honest, and re-selecting them is a no-op.
  */
  const ownerSelectOptions = useMemo(() => {
    if (ownerOptions.some((o) => o.value === currentKey)) return ownerOptions
    return [
      ...ownerOptions,
      { value: currentKey, label: `${displayRepName(currentKey)} — not on the roster` },
    ]
  }, [ownerOptions, currentKey])

  if (!view) return null
  const { row, phones, calls, packageLabel, packageValue } = view

  async function changeOwner(nextKey: string) {
    if (nextKey === currentKey) return
    const target = (salesUsers.data ?? []).find((u) => salesUserKey(u) === nextKey)
    // Unknown key that isn't the sentinel means the roster moved under us.
    if (nextKey !== UNASSIGNED && !target) return

    const assignedto = target ? assignedtoSpelling(target) : null
    try {
      await reassign.mutateAsync({ ids: [row.id], assignedto })
      showToast({
        message: assignedto
          ? `${row.name || 'Prospect'} assigned to ${assignedto}`
          : `${row.name || 'Prospect'} is now unassigned`,
        tone: 'success',
      })
    } catch (error) {
      showToast({ message: describeWriteError(error, 'reassign this prospect'), tone: 'error' })
    }
  }

  const entries: TimelineEntry[] = calls.map((call) => ({
    id: call.id,
    // `createdat` is authoritative on calls; `date`/`time` are display-only text.
    date: new Date(timeOf(call.createdat)),
    time: call.time ?? '',
    rep: displayRepName(call.rep),
    outcome: toOutcome(call.outcome),
    note: call.notes ?? '',
  }))

  // One copy path for both the inline section and the full-screen reader.
  const copyScript = () => void navigator.clipboard?.writeText(row.script ?? '')

  return (
    <>
      <SlideOver open onClose={onClose} title={row.name || 'Unnamed'}>
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm text-text-muted">
              {[row.type, row.area].filter(Boolean).join(' · ') || '—'}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {packageLabel || 'No package'}
              {packageValue !== null && ` — Rs ${packageValue.toLocaleString('en-US')}`}
              {row.assignedto && ` · ${displayRepName(row.assignedto)}`}
            </p>
            {view.duplicateName && (
              <p className="mt-2 rounded-sm border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">
                Another prospect shares this business name. The call history below is matched by name,
                so it may include calls belonging to the other record.
              </p>
            )}
          </div>

          {/*
            WhatsApp deliberately omitted: the contact rows below already carry a
            working per-number wa.me link. A second affordance for the same action
            is just a second thing to break, and it can't know which number to use
            when a prospect has two.
          */}
          <div className="flex flex-wrap gap-2">
            <Button size="default" variant="primary" onClick={() => onLogCall(view)}>
              Log call
            </Button>
            <Button
              size="default"
              variant="secondary"
              onClick={() => onLogCall(view, NEEDS_FOLLOWUP)}
            >
              Add follow-up
            </Button>
          </div>

          {canAssign && (
            <section>
              <h3 className="mb-2 font-display text-lg text-text">Owner</h3>
              <Field
                label="Assigned to"
                htmlFor="prospect-owner"
                hint="Writes prospects.assignedto. Reps see only their own prospects."
              >
                <Select
                  id="prospect-owner"
                  options={ownerSelectOptions}
                  value={currentKey}
                  disabled={salesUsers.isLoading || reassign.isPending}
                  onChange={(e) => void changeOwner(e.target.value)}
                />
              </Field>
            </section>
          )}

          <section>
            <h3 className="mb-2 font-display text-lg text-text">Contact</h3>
            {phones.length === 0 ? (
              <p className="text-sm text-text-subtle">No phone number on record.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {/*
                  One link pair per number, primary and alt alike — a row holding
                  two numbers must offer both. Each is normalised on its own; a
                  number too short to dial gets a disabled control, which is why
                  an unusable alt can't take the primary's link with it.
                */}
                {phones.map((p, i) => {
                  const link = toPhoneLink(p)
                  return (
                  <li key={p} className="flex items-center gap-2 text-sm">
                    <span className="font-mono tracking-[0.02em] text-text">{formatPhone(p)}</span>
                    <span className="text-2xs text-text-subtle">{i === 0 ? 'primary' : 'alt'}</span>
                    {link ? (
                      <a
                        href={`tel:${link.tel}`}
                        title="Call"
                        className="focus-ring ml-auto rounded-sm p-1 text-brand"
                      >
                        <Phone size={16} strokeWidth={1.75} />
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Phone number on record is incomplete"
                        aria-label="Call — phone number on record is incomplete"
                        className="focus-ring ml-auto cursor-not-allowed rounded-sm p-1 text-text-subtle opacity-40"
                      >
                        <Phone size={16} strokeWidth={1.75} />
                      </button>
                    )}
                    {link ? (
                      <a
                        href={`https://wa.me/${link.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="WhatsApp"
                        className="focus-ring rounded-sm p-1 text-success"
                      >
                        <MessageCircle size={16} strokeWidth={1.75} />
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Phone number on record is incomplete"
                        aria-label="WhatsApp — phone number on record is incomplete"
                        className="focus-ring cursor-not-allowed rounded-sm p-1 text-text-subtle opacity-40"
                      >
                        <MessageCircle size={16} strokeWidth={1.75} />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Copy"
                      onClick={() => void navigator.clipboard?.writeText(p)}
                      className="focus-ring rounded-sm p-1 text-text-muted hover:text-text"
                    >
                      <Copy size={16} strokeWidth={1.75} />
                    </button>
                  </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 font-display text-lg text-text">Timeline</h3>
            {entries.length === 0 ? (
              <EmptyState
                message="No calls logged for this prospect yet."
                action={
                  <Button size="sm" variant="primary" onClick={() => onLogCall(view)}>
                    Log call
                  </Button>
                }
              />
            ) : (
              <Timeline entries={entries} />
            )}
          </section>

          {row.pain && (
            <section>
              <h3 className="mb-2 font-display text-lg text-text">Pain / notes</h3>
              <p className="whitespace-pre-wrap text-sm text-text-muted">{row.pain}</p>
            </section>
          )}

          {row.script && (
            <section>
              {/*
                The expand control is a sibling of the toggle, not inside it — a
                button can't nest inside a button.
              */}
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => setScriptOpen((v) => !v)}
                  aria-expanded={scriptOpen}
                  className="focus-ring flex flex-1 items-center justify-between rounded-sm border border-border px-3 py-2 text-left text-sm text-text hover:bg-surface-2"
                >
                  Cold call script
                  <span className="text-xs text-text-subtle">{scriptOpen ? 'Hide' : 'Show'}</span>
                </button>
                <button
                  type="button"
                  aria-label="Expand script"
                  onClick={() => setReaderOpen(true)}
                  className="focus-ring flex w-9 shrink-0 items-center justify-center rounded-sm border border-border text-text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text motion-reduce:transition-none"
                >
                  <Maximize2 size={16} strokeWidth={1.75} />
                </button>
              </div>
              {scriptOpen && (
                <div className="mt-2 rounded-sm border border-border bg-surface-2 p-3">
                  <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-text-muted">
                    {row.script}
                  </pre>
                  <Button size="sm" variant="secondary" className="mt-2" onClick={copyScript}>
                    Copy for call
                  </Button>
                </div>
              )}
            </section>
          )}

          <p className="text-2xs text-text-subtle">
            Added {row.created_at ? formatDetailDate(new Date(row.created_at)) : 'unknown'} by{' '}
            {resolveCreatedBy(row)}
          </p>
        </div>
      </SlideOver>
      {/*
        Rendered as a sibling of the slide-over, not inside it: the slide-over
        root is a z-40 stacking context, so a nested overlay could never paint
        above it.
      */}
      {row.script && (
        <ScriptReader
          open={readerOpen}
          script={row.script}
          onClose={() => setReaderOpen(false)}
          onCopy={copyScript}
        />
      )}
    </>
  )
}
