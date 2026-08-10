import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { addDays, format } from 'date-fns'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'
import { ProspectPicker } from '../../components/shared/ProspectPicker'
import type { ProspectRow } from '../../types/db'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../auth/useAuth'
import { useLogCall } from '../../api/calls'
import { CANONICAL_OUTCOMES, CREATES_LEAD, NEEDS_FOLLOWUP, type CanonicalOutcome } from '../../api/outcomes'
import { describeWriteError } from '../../api/writeError'

const SNOOZE = [
  { label: '+1d', days: 1 },
  { label: '+3d', days: 3 },
  { label: '+1w', days: 7 },
]

/**
 * `yyyy-MM-dd` in local wall-clock, matching the text already stored in every
 * dated row. Never `toISOString()`: that emits a datetime in UTC, which both
 * shifts the day across the Colombo offset and sorts differently from the
 * existing rows, so the queue would order wrong.
 */
function isoDay(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/** The stored shape, enforced before any write. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

interface LogCallSheetProps {
  open: boolean
  onClose: () => void
  /** Defaults to the last-viewed prospect so the common path is two taps. */
  defaultProspect?: string
  defaultPhone?: string
  /**
   * Preselects an outcome. "Add follow-up" uses this to open straight into the
   * follow-up flow — a follow-up in this system only ever comes from a call, so
   * it is the same sheet, not a separate one.
   */
  defaultOutcome?: CanonicalOutcome | null
  /**
   * Selectable prospects. Only supplied by the standalone entry point on My
   * Calls, where the rep must pick one; when the sheet is opened from a
   * prospect the business is fixed and this is unused.
   */
  prospects?: ProspectRow[]
}

export function LogCallSheet({
  open,
  onClose,
  defaultProspect = '',
  defaultPhone = '',
  defaultOutcome = null,
  prospects = [],
}: LogCallSheetProps) {
  const { profile, repKey } = useAuth()
  const { showToast } = useToast()
  const logCall = useLogCall()

  // Picker mode holds a ProspectRow, never a string — free text has no
  // representation in this component's state at all.
  const [picked, setPicked] = useState<ProspectRow | null>(null)
  const [outcome, setOutcome] = useState<CanonicalOutcome | null>(defaultOutcome)
  const [followup, setFollowup] = useState(isoDay(addDays(new Date(), 1)))
  const [followupError, setFollowupError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  // Re-seed when reopened for a different prospect.
  useEffect(() => {
    if (open) {
      setPicked(null)
      setOutcome(defaultOutcome)
      setFollowup(isoDay(addDays(new Date(), 1)))
      setFollowupError(null)
      setNotes('')
    }
  }, [open, defaultProspect, defaultOutcome])

  const needsFollowup = outcome === NEEDS_FOLLOWUP
  const createsLead = outcome === CREATES_LEAD

  // When opened from a prospect the name is fixed and always valid.
  const boundToProspect = Boolean(defaultProspect)

  /**
   * The exact `prospects.name` this call will join to, or null. Either the name
   * the sheet was opened with, or the name of a *selected* prospect — there is
   * no third source, so `calls.prospect` always matches `prospects.name`.
   */
  const matchedProspect = boundToProspect ? defaultProspect : (picked?.name ?? null)

  // A call with no matching prospect is orphaned and invisible — block it.
  const canSave = Boolean(matchedProspect && outcome) && !logCall.isPending

  async function save() {
    if (!outcome || !matchedProspect) return

    /*
      'Follow-up needed' without a date is what produced 305 rows that could
      never appear in the queue. Validated here rather than by disabling the
      button: a disabled button blocks the save silently and never explains
      why. This applies to this one outcome only — every other outcome saves
      with no date, as before.
    */
    const date = followup.trim()
    if (needsFollowup && !ISO_DAY.test(date)) {
      setFollowupError(
        date ? 'Use a date in YYYY-MM-DD format.' : 'Pick a follow-up date — this outcome requires one.'
      )
      return
    }
    setFollowupError(null)

    try {
      await logCall.mutateAsync({
        input: {
          // The canonical name, not the typed text.
          prospect: matchedProspect,
          outcome,
          notes,
          phone: defaultPhone,
          followup: needsFollowup ? date : null,
        },
        // Stored rep value: v1 wrote the username, and canonicalRepKey()
        // normalises it on read.
        rep: profile?.username ?? repKey,
      })
      showToast({ message: 'Call logged', tone: 'success' })
      onClose()
    } catch (error) {
      // Never swallowed: the optimistic row is already rolled back, and the
      // sheet stays open so the rep can retry without retyping (SPEC §0.5).
      showToast({ message: describeWriteError(error, 'log this call'), tone: 'error' })
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log call">
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs text-text-muted" htmlFor="lc-prospect">
            Business
          </label>
          {boundToProspect ? (
            /*
              Bound to the exact prospects.name it was opened from, read-only.
              calls.prospect joins prospects.name by text with no FK, so a typo
              or a free-text value creates a call that joins to nothing and is
              invisible everywhere (SPEC §0.7).
            */
            <Input id="lc-prospect" value={defaultProspect} readOnly aria-readonly="true" />
          ) : (
            <>
              <ProspectPicker
                id="lc-prospect"
                prospects={prospects}
                value={picked}
                onChange={setPicked}
                autoFocus
              />
              {!picked && (
                <p className="mt-1 text-2xs text-text-subtle">
                  Select a prospect — a call must attach to one.
                </p>
              )}
            </>
          )}
        </div>

        <div>
          <span className="mb-1 block text-xs text-text-muted">Outcome</span>
          {/* A grid, not a dropdown — two taps beats a select on mobile (§7). */}
          <div className="grid grid-cols-2 gap-2">
            {CANONICAL_OUTCOMES.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={outcome === o}
                onClick={() => setOutcome(o)}
                className={clsx(
                  'focus-ring flex min-h-[44px] items-center justify-center rounded-sm border px-2 text-sm transition-colors duration-[120ms] motion-reduce:transition-none',
                  outcome === o
                    ? 'border-brand bg-brand-ghost text-brand'
                    : 'border-border-strong text-text hover:bg-surface-2'
                )}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        {needsFollowup && (
          <div>
            <label className="mb-1 block text-xs text-text-muted" htmlFor="lc-followup">
              Follow up on <span className="text-danger">*</span>
            </label>
            <Input
              id="lc-followup"
              type="date"
              value={followup}
              aria-invalid={followupError ? true : undefined}
              aria-describedby={followupError ? 'lc-followup-error' : undefined}
              onChange={(e) => {
                setFollowup(e.target.value)
                // Clear as soon as they act on it — a stale error next to a
                // now-valid field reads as a bug.
                if (followupError) setFollowupError(null)
              }}
            />
            {followupError && (
              <p id="lc-followup-error" role="alert" className="mt-1 text-2xs text-danger">
                {followupError}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              {SNOOZE.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setFollowup(isoDay(addDays(new Date(), s.days)))
                    if (followupError) setFollowupError(null)
                  }}
                  className="focus-ring rounded-sm border border-border-strong px-2 py-1 text-xs text-text hover:bg-surface-2"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {createsLead && (
          <p className="rounded-sm border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">
            This will create a pipeline lead.
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs text-text-muted" htmlFor="lc-notes">
            Notes
          </label>
          <Textarea
            id="lc-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Sinhala, romanized, or English — all fine."
          />
        </div>

        <Button
          size="mobile"
          variant="primary"
          className="w-full"
          disabled={!canSave}
          loading={logCall.isPending}
          onClick={() => void save()}
        >
          {logCall.isPending ? 'Saving…' : 'Log call'}
        </Button>
      </div>
    </Sheet>
  )
}
