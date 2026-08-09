import { useEffect, useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { describeWriteError } from '../../api/writeError'
import { useUpdateLeadStage } from '../../api/leads'
import type { LeadView } from './usePipeline'

interface LostSheetProps {
  view: LeadView | null
  onClose: () => void
}

/**
 * Marking a deal lost. Asks a reason and writes **only** to `interested_leads`
 * — never `closed_deals`. A lost deal is not revenue, and a row in the revenue
 * table for one would corrupt every figure downstream.
 *
 * Mirrors v1's callback handler (`index.html:13791-13794`): `callbackNotes`,
 * `callbackOutcome` and `status` move together so both apps read the same shape
 * during the parallel week.
 */
export function LostSheet({ view, onClose }: LostSheetProps) {
  const { showToast } = useToast()
  const updateStage = useUpdateLeadStage()
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (view) setReason('')
  }, [view])

  if (!view) return null

  const name = view.row.biz || 'Unnamed'
  const canSave = reason.trim() !== '' && !updateStage.isPending

  async function save() {
    if (!view || !canSave) return
    try {
      await updateStage.mutateAsync({
        id: view.row.id,
        status: 'lost',
        outcome: 'lost',
        notes: reason.trim(),
      })
      showToast({ message: 'Marked lost', tone: 'success' })
      onClose()
    } catch (error) {
      showToast({ message: describeWriteError(error, 'mark this lost'), tone: 'error' })
    }
  }

  return (
    <Sheet open onClose={onClose} title={`Mark lost — ${name}`}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs text-text-muted" htmlFor="lost-reason">
            Why was it lost?
          </label>
          <Textarea
            id="lost-reason"
            rows={3}
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Price, timing, went with someone else…"
          />
          <p className="mt-1 text-2xs text-text-subtle">
            Recorded on the lead. Nothing is written to revenue.
          </p>
        </div>

        <Button
          size="mobile"
          variant="destructive"
          className="w-full"
          disabled={!canSave}
          loading={updateStage.isPending}
          onClick={() => void save()}
        >
          {updateStage.isPending ? 'Saving…' : 'Mark lost'}
        </Button>
      </div>
    </Sheet>
  )
}
