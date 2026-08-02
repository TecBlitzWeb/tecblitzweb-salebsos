import clsx from 'clsx'

export type CallOutcome =
  | 'interested'
  | 'followup'
  | 'whatsapp'
  | 'not-interested'
  | 'no-answer'
  | 'new'

interface OutcomeMeta {
  label: string
  /** 12% alpha background, full-strength text (§4). Never a solid fill. */
  className: string
  /** Bare colour utility for the Timeline dot. */
  dotClass: string
}

export const OUTCOME_META: Record<CallOutcome, OutcomeMeta> = {
  interested: {
    label: 'Interested',
    className: 'bg-success/12 text-success',
    dotClass: 'bg-success',
  },
  followup: {
    label: 'Follow-up needed',
    className: 'bg-warning/12 text-warning',
    dotClass: 'bg-warning',
  },
  whatsapp: {
    label: 'WhatsApp sent',
    className: 'bg-info/12 text-info',
    dotClass: 'bg-info',
  },
  'not-interested': {
    label: 'Not interested',
    className: 'bg-danger/12 text-danger',
    dotClass: 'bg-danger',
  },
  'no-answer': {
    label: 'No answer',
    className: 'bg-text-subtle/12 text-text-subtle',
    dotClass: 'bg-text-subtle',
  },
  new: {
    label: 'New',
    className: 'bg-brand/12 text-brand',
    dotClass: 'bg-brand',
  },
}

export const ALL_OUTCOMES = Object.keys(OUTCOME_META) as CallOutcome[]

interface StatusChipProps {
  outcome: CallOutcome
  className?: string
}

/** §4: 20px tall, 0 8px padding, text-xs, weight 500, radius-sm. */
export function StatusChip({ outcome, className }: StatusChipProps) {
  const meta = OUTCOME_META[outcome]
  return (
    <span
      className={clsx(
        'inline-flex h-5 shrink-0 items-center rounded-sm px-2 text-xs font-medium',
        meta.className,
        className
      )}
    >
      {meta.label}
    </span>
  )
}
