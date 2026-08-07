import { useState } from 'react'
import { Copy, MessageCircle, Phone } from 'lucide-react'
import { SlideOver } from '../../components/ui/SlideOver'
import { Button } from '../../components/ui/Button'
import { Timeline, type TimelineEntry } from '../../components/shared/Timeline'
import { EmptyState } from '../../components/shared/EmptyState'
import { formatDetailDate, formatPhone } from '../../lib/format'
import { displayRepName } from '../../lib/repKey'
import { resolveCreatedBy } from '../../api/prospects'
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

export function ProspectDetail({ view, onClose, onLogCall }: ProspectDetailProps) {
  const [scriptOpen, setScriptOpen] = useState(false)

  if (!view) return null
  const { row, phones, calls, packageLabel, packageValue } = view

  const entries: TimelineEntry[] = calls.map((call) => ({
    id: call.id,
    // `createdat` is authoritative on calls; `date`/`time` are display-only text.
    date: new Date(timeOf(call.createdat)),
    time: call.time ?? '',
    rep: displayRepName(call.rep),
    outcome: toOutcome(call.outcome),
    note: call.notes ?? '',
  }))

  return (
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

        <section>
          <h3 className="mb-2 font-display text-lg text-text">Contact</h3>
          {phones.length === 0 ? (
            <p className="text-sm text-text-subtle">No phone number on record.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {phones.map((p, i) => (
                <li key={p} className="flex items-center gap-2 text-sm">
                  <span className="font-mono tracking-[0.02em] text-text">{formatPhone(p)}</span>
                  <span className="text-2xs text-text-subtle">{i === 0 ? 'primary' : 'alt'}</span>
                  <a href={`tel:${p}`} title="Call" className="focus-ring ml-auto rounded-sm p-1 text-brand">
                    <Phone size={16} strokeWidth={1.75} />
                  </a>
                  <a
                    href={`https://wa.me/${p.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="WhatsApp"
                    className="focus-ring rounded-sm p-1 text-success"
                  >
                    <MessageCircle size={16} strokeWidth={1.75} />
                  </a>
                  <button
                    type="button"
                    title="Copy"
                    onClick={() => void navigator.clipboard?.writeText(p)}
                    className="focus-ring rounded-sm p-1 text-text-muted hover:text-text"
                  >
                    <Copy size={16} strokeWidth={1.75} />
                  </button>
                </li>
              ))}
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
            <button
              type="button"
              onClick={() => setScriptOpen((v) => !v)}
              aria-expanded={scriptOpen}
              className="focus-ring flex w-full items-center justify-between rounded-sm border border-border px-3 py-2 text-left text-sm text-text hover:bg-surface-2"
            >
              Cold call script
              <span className="text-xs text-text-subtle">{scriptOpen ? 'Hide' : 'Show'}</span>
            </button>
            {scriptOpen && (
              <div className="mt-2 rounded-sm border border-border bg-surface-2 p-3">
                <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-text-muted">
                  {row.script}
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => void navigator.clipboard?.writeText(row.script ?? '')}
                >
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
  )
}
