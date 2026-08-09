import { useEffect, useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { describeWriteError } from '../../api/writeError'
import { useAddClosedDeal } from '../../api/deals'
import { useUpdateLeadStage } from '../../api/leads'
import { colomboDateTime, formatCurrency } from '../../lib/format'
import type { LeadView } from './usePipeline'

interface WonSheetProps {
  view: LeadView | null
  onClose: () => void
}

/**
 * Marking a deal won (DESIGN_RULES §7): asks for the final value and the date,
 * then writes `closed_deals`.
 *
 * The value is never defaulted. v1 fell back to a hardcoded 120000
 * (`index.html:13748`) and invented revenue that nobody entered. If the lead
 * carries no package this sheet asks for that too, because a deal row without
 * `pkg` cannot tell Revenue what was sold.
 */
export function WonSheet({ view, onClose }: WonSheetProps) {
  const { showToast } = useToast()
  const addDeal = useAddClosedDeal()
  const updateStage = useUpdateLeadStage()

  const [value, setValue] = useState('')
  const [date, setDate] = useState(colomboDateTime().date)
  const [pkg, setPkg] = useState('')

  const storedPkg = (view?.row.pkg ?? '').trim()
  const needsPackage = storedPkg === ''

  useEffect(() => {
    if (view) {
      // Deliberately blank, not prefilled from the package estimate — a
      // prefilled figure gets accepted without being read.
      setValue('')
      setDate(colomboDateTime().date)
      setPkg('')
    }
  }, [view])

  if (!view) return null

  const name = view.row.biz || 'Unnamed'
  const parsedValue = Number(value.replace(/[^\d.]/g, ''))
  const valueOk = Number.isFinite(parsedValue) && parsedValue > 0
  const packageOk = !needsPackage || pkg.trim() !== ''
  const pending = addDeal.isPending || updateStage.isPending
  const canSave = valueOk && packageOk && date.trim() !== '' && !pending

  async function save() {
    if (!view || !canSave) return
    try {
      // The deal row is written first. If this fails the lead stays where it is,
      // so there is never a lead sitting in Won with no revenue behind it —
      // which is precisely how v1 reported Rs 0 (SPEC §0.5).
      const result = await addDeal.mutateAsync({
        leadId: view.row.id,
        biz: name,
        value: parsedValue,
        date,
        pkg: needsPackage ? pkg.trim() : storedPkg,
        rep: view.row.rep,
      })

      await updateStage.mutateAsync({
        id: view.row.id,
        status: 'won',
        outcome: 'won',
        notes: view.row.callbackNotes ?? undefined,
        // Matches v1's Won handler (index.html:13745) so a lead won here
        // behaves identically in v1 during the parallel week.
        advanceCleared: true,
      })

      showToast({
        message: result.duplicate
          ? 'Already recorded — this lead had a deal, so nothing was written twice.'
          : `Deal won — ${formatCurrency(parsedValue)} recorded`,
        tone: 'success',
      })
      onClose()
    } catch (error) {
      showToast({ message: describeWriteError(error, 'record this deal'), tone: 'error' })
    }
  }

  return (
    <Sheet open onClose={onClose} title={`Mark won — ${name}`}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs text-text-muted" htmlFor="won-value">
            Final value (Rs)
          </label>
          <Input
            id="won-value"
            inputMode="numeric"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 120000"
          />
          {view.packageValue !== null && (
            <p className="mt-1 text-2xs text-text-subtle">
              Package suggests {formatCurrency(view.packageValue)} — confirm the real figure.
            </p>
          )}
          {value.trim() !== '' && !valueOk && (
            <p className="mt-1 text-2xs text-danger">Enter the amount actually agreed.</p>
          )}
        </div>

        {needsPackage && (
          <div>
            <label className="mb-1 block text-xs text-text-muted" htmlFor="won-pkg">
              Package
            </label>
            <Input
              id="won-pkg"
              value={pkg}
              onChange={(e) => setPkg(e.target.value)}
              placeholder="e.g. Business Website"
            />
            <p className="mt-1 text-2xs text-text-subtle">
              This lead has no package on record, and Revenue needs one to report what was sold.
            </p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs text-text-muted" htmlFor="won-date">
            Date closed
          </label>
          <Input
            id="won-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <Button
          size="mobile"
          variant="primary"
          className="w-full"
          disabled={!canSave}
          loading={pending}
          onClick={() => void save()}
        >
          {pending ? 'Recording…' : 'Record deal'}
        </Button>
      </div>
    </Sheet>
  )
}
