import { useEffect, useMemo, useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import { displayRepName } from '../../lib/repKey'
import { useAuth } from '../../auth/useAuth'
import { useAddProspect, joinPhones } from '../../api/prospects'
import { useSalesUsers } from '../../api/users'
import { describeWriteError } from '../../api/writeError'
import type { ProspectView } from './useProspectList'

const TYPES = [
  'Hotel/Guesthouse', 'Salon', 'Restaurant', 'Garage', 'Retail',
  'Construction', 'Education', 'Medical', 'Other',
]

/** Cheap fuzzy match: normalise, then substring either direction. */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9඀-෿]+/g, ' ').trim()
}

function fuzzyMatches(needle: string, views: ProspectView[]): ProspectView[] {
  const q = normalise(needle)
  if (q.length < 3) return []
  return views
    .filter((v) => {
      const n = normalise(v.row.name ?? '')
      return n && (n.includes(q) || q.includes(n))
    })
    .slice(0, 3)
}

interface ProspectSheetProps {
  open: boolean
  onClose: () => void
  views: ProspectView[]
  areas: string[]
  onOpenExisting: (view: ProspectView) => void
}

/**
 * Add prospect. Duplicate detection runs as you type on both name and phone —
 * this is the guard against the Zanbara Villa triplication (DESIGN_RULES §6c).
 */
export function ProspectSheet({ open, onClose, views, areas, onOpenExisting }: ProspectSheetProps) {
  const { profile, role } = useAuth()
  const { showToast } = useToast()
  const addProspect = useAddProspect()
  const users = useSalesUsers()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [phone2, setPhone2] = useState('')
  const [type, setType] = useState('')
  const [area, setArea] = useState('')
  const [pkg, setPkg] = useState('')
  const [pain, setPain] = useState('')
  const [script, setScript] = useState('')
  const [scriptOpen, setScriptOpen] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  // CEO and Co-CEO choose; a Sales rep is locked to themselves (§6c step 7).
  const canAssignOthers = role === 'CEO' || role === 'Co-CEO'
  const ownUsername = profile?.username ?? ''

  /**
   * The option *value* is the stored `sales_users.username`, because that is
   * what `prospects.assignedto` holds and what the DB's canonical_rep() reduces
   * on. The label is the human name — never write the label.
   */
  const assignableOptions = useMemo(() => {
    if (!canAssignOthers) {
      return ownUsername
        ? [{ value: ownUsername, label: displayRepName(ownUsername) }]
        : []
    }
    return (users.data ?? [])
      .filter((u) => u.username)
      .map((u) => ({ value: u.username!, label: u.name?.trim() || displayRepName(u.username) }))
  }, [canAssignOthers, ownUsername, users.data])

  const [assignedto, setAssignedto] = useState(ownUsername)

  // A Sales rep is always themselves; re-seed once the profile resolves.
  useEffect(() => {
    if (!canAssignOthers && ownUsername) setAssignedto(ownUsername)
  }, [canAssignOthers, ownUsername])

  const nameMatches = useMemo(() => fuzzyMatches(name, views), [name, views])
  const phoneMatches = useMemo(() => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 7) return []
    return views.filter((v) => v.phones.some((p) => p.replace(/\D/g, '') === digits)).slice(0, 3)
  }, [phone, views])

  const duplicates = nameMatches.length > 0 ? nameMatches : phoneMatches
  const blocked = duplicates.length > 0 && !acknowledged
  // assignedto is required — an unassigned prospect surfaces in nobody's queue.
  const canSave =
    Boolean(name.trim()) && Boolean(assignedto.trim()) && !blocked && !addProspect.isPending

  function reset() {
    setName(''); setPhone(''); setPhone2(''); setType('')
    setArea(''); setPkg(''); setPain(''); setScript('')
    setScriptOpen(false); setAcknowledged(false)
    setAssignedto(canAssignOthers ? '' : ownUsername)
  }

  async function save() {
    try {
      await addProspect.mutateAsync({
        input: {
          name,
          phone: joinPhones([phone, phone2]),
          type,
          area,
          pkg,
          pain,
          script,
          // The stored username, so it matches canonical_rep() on the DB side.
          assignedto,
        },
        author: profile?.name ?? profile?.username ?? 'Unknown',
      })
      showToast({ message: 'Prospect added', tone: 'success' })
      reset()
      onClose()
    } catch (error) {
      // Rolled back already; the sheet stays open with the typed values intact
      // so the rep can retry without re-entering anything (SPEC §0.5).
      showToast({ message: describeWriteError(error, 'add this prospect'), tone: 'error' })
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add prospect">
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs text-text-muted" htmlFor="p-name">
            Business name
          </label>
          <Input
            id="p-name"
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setAcknowledged(false)
            }}
            placeholder="SpringView Holiday Home"
          />
        </div>

        {duplicates.length > 0 && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
            <p className="text-sm text-text">
              {duplicates.length === 1 ? 'This may already exist.' : 'These may already exist.'}
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {duplicates.map((d) => (
                <li key={d.row.id} className="text-xs text-text-muted">
                  <span className="text-text">{d.row.name}</span>
                  {d.row.assignedto && ` — assigned to ${displayRepName(d.row.assignedto)}`}
                  {d.daysSinceLastCall !== null
                    ? `, last called ${d.daysSinceLastCall} days ago`
                    : ', never called'}
                  <div className="mt-1 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => onOpenExisting(d)}>
                      Open it
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => setAcknowledged(true)}
              disabled={acknowledged}
            >
              {acknowledged ? 'Adding anyway' : 'Add anyway'}
            </Button>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs text-text-muted" htmlFor="p-phone">
            Phone
          </label>
          <Input
            id="p-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="077 352 2686"
            className="font-mono"
          />
        </div>

        {phone.trim() && (
          <div>
            <label className="mb-1 block text-xs text-text-muted" htmlFor="p-phone2">
              Phone 2 — optional
            </label>
            <Input
              id="p-phone2"
              value={phone2}
              onChange={(e) => setPhone2(e.target.value)}
              placeholder="077 273 3319"
              className="font-mono"
            />
            <p className="mt-1 text-2xs text-text-subtle">
              Stored in one column, joined with “/”.
            </p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs text-text-muted" htmlFor="p-type">Type</label>
          <Select
            id="p-type"
            placeholder="Choose a type"
            options={TYPES.map((t) => ({ value: t, label: t }))}
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-text-muted" htmlFor="p-area">Area</label>
          <Input
            id="p-area"
            list="p-areas"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Badulla"
          />
          <datalist id="p-areas">
            {areas.map((a) => <option key={a} value={a} />)}
          </datalist>
        </div>

        <div>
          <label className="mb-1 block text-xs text-text-muted" htmlFor="p-pkg">Package</label>
          <Input
            id="p-pkg"
            value={pkg}
            onChange={(e) => setPkg(e.target.value)}
            placeholder="Landing Page - 65,000"
          />
          <p className="mt-1 text-2xs text-text-subtle">
            Free text — the value lives inside this string.
          </p>
        </div>

        {/* §6c step 7 — between Package and Pain. */}
        <div>
          <label className="mb-1 block text-xs text-text-muted" htmlFor="p-assign">
            Assign to
          </label>
          <Select
            id="p-assign"
            placeholder={canAssignOthers ? 'Choose a person' : undefined}
            options={assignableOptions}
            value={assignedto}
            onChange={(e) => setAssignedto(e.target.value)}
            disabled={!canAssignOthers}
          />
          <p className="mt-1 text-2xs text-text-subtle">
            {canAssignOthers
              ? 'Required — an unassigned prospect never surfaces in anyone’s queue.'
              : 'Sales reps can only create work for themselves.'}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs text-text-muted" htmlFor="p-pain">Pain / notes</label>
          <Textarea id="p-pain" rows={3} value={pain} onChange={(e) => setPain(e.target.value)} />
        </div>

        <div>
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
            <Textarea
              rows={8}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="mt-2 font-mono text-xs"
              placeholder="Kept out of the notes field, on purpose."
            />
          )}
        </div>

        <Button
          size="mobile"
          variant="primary"
          className="w-full"
          disabled={!canSave}
          loading={addProspect.isPending}
          onClick={() => void save()}
        >
          {addProspect.isPending ? 'Adding…' : 'Add prospect'}
        </Button>
        {blocked && (
          <p className="text-2xs text-warning">
            Resolve the possible duplicate above, or choose “Add anyway”.
          </p>
        )}
      </div>
    </Sheet>
  )
}
