import { useState } from 'react'
import { Section, Row } from '../KitchenSinkSection'
import { Button } from '../../../components/ui/Button'
import { SlideOver } from '../../../components/ui/SlideOver'
import { Sheet } from '../../../components/ui/Sheet'
import { useToast } from '../../../components/ui/Toast'
import { Skeleton, ProspectCardSkeleton, TableSkeleton } from '../../../components/ui/Skeleton'
import { EmptyState } from '../../../components/shared/EmptyState'
import { ErrorState } from '../../../components/shared/ErrorState'
import { Timeline } from '../../../components/shared/Timeline'
import { Input, Field } from '../../../components/ui/Input'
import { TIMELINE_ENTRIES } from '../fixtures'

export function FeedbackSection() {
  const { showToast } = useToast()
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <Section title="Overlays" note="Slide-over 480px desktop / full-screen mobile. Sheet slides up on mobile.">
        <Row>
          <Button variant="secondary" onClick={() => setSlideOverOpen(true)}>
            Open slide-over
          </Button>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Open sheet
          </Button>
        </Row>
      </Section>

      <Section title="Toasts" note="§6c — 5 second undo window on create and destructive actions.">
        <Row>
          <Button onClick={() => showToast({ message: 'Prospect added', onUndo: () => {} })}>
            Toast with undo
          </Button>
          <Button
            variant="secondary"
            onClick={() => showToast({ message: 'Call logged' })}
          >
            Plain toast
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              showToast({ message: 'Save failed (403). Check your permissions.', tone: 'error' })
            }
          >
            Error toast
          </Button>
        </Row>
      </Section>

      <Section title="Timeline" note="§6b — call history. Sinhala and romanized Sinhala notes render here.">
        <div className="max-w-md rounded-md border border-border bg-surface p-3.5">
          <Timeline entries={TIMELINE_ENTRIES} />
        </div>
      </Section>

      <Section title="Skeletons" note="§8 — match the real layout's shape, reserve its space, never a spinner.">
        <div className="mb-3 flex flex-col gap-2">
          <ProspectCardSkeleton />
          <ProspectCardSkeleton />
        </div>
        <TableSkeleton rows={4} columns={5} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-40" />
        </div>
      </Section>

      <Section title="Empty and error states" note="§8 — an error never renders as an empty state.">
        <div className="grid gap-3 lg:grid-cols-2">
          <EmptyState
            message="No prospects match these filters."
            action={
              <Button variant="secondary" size="sm">
                Clear filters
              </Button>
            }
          />
          <EmptyState
            message="No calls logged today."
            action={<Button size="sm">Log a call</Button>}
          />
          <ErrorState
            message="Couldn't load prospects. Check your connection."
            status={503}
            onRetry={() => {}}
          />
          <ErrorState
            message="Save failed. You may not have permission to change this person."
            status={403}
            onRetry={() => {}}
            onCopyDetails={() => {}}
          />
        </div>
      </Section>

      <SlideOver
        open={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        title={
          <div>
            <div className="text-lg font-medium text-text">SpringView Holiday Home</div>
            <div className="text-xs text-text-muted">Hotel · Guesthouse · Badulla</div>
          </div>
        }
        footer={
          <div className="flex gap-2">
            <Button className="flex-1">Log call</Button>
            <Button variant="secondary" className="flex-1">
              WhatsApp
            </Button>
          </div>
        }
      >
        <div className="mb-4 text-2xs text-text-subtle">Timeline</div>
        <Timeline entries={TIMELINE_ENTRIES} />
      </SlideOver>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Add prospect"
        footer={
          <Button size="mobile" className="w-full">
            Add prospect
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Business name" htmlFor="sheet-name">
            <Input id="sheet-name" autoFocus placeholder="SpringView Holiday Home" />
          </Field>
          <Field label="Phone" htmlFor="sheet-phone">
            <Input id="sheet-phone" className="font-mono tracking-[0.02em]" placeholder="077 352 2686" />
          </Field>
        </div>
      </Sheet>
    </>
  )
}
