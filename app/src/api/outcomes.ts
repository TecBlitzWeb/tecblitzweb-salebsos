import type { CallOutcome } from '../components/shared/StatusChip'

/**
 * The exact strings production already stores in `calls.outcome`, taken from
 * v1 (index.html:10859). Writing anything else — different casing, a new
 * value — creates rows that v1's dashboards and every existing query silently
 * fail to count. This list is a data contract, not a UI preference.
 *
 * DESIGN_RULES §4 lists six chips, but the sixth ("New / no calls") is a
 * derived state meaning *no call exists*, so it is not loggable. Five buttons,
 * not six. Inventing a sixth outcome would pollute the column.
 */
export const CANONICAL_OUTCOMES = [
  'Interested',
  'Follow-up needed',
  'WhatsApp sent',
  'Not interested',
  'No answer',
] as const

export type CanonicalOutcome = (typeof CANONICAL_OUTCOMES)[number]

/** Maps a canonical stored value onto its chip. */
export const OUTCOME_TO_CHIP: Record<CanonicalOutcome, CallOutcome> = {
  Interested: 'interested',
  'Follow-up needed': 'followup',
  'WhatsApp sent': 'whatsapp',
  'Not interested': 'not-interested',
  'No answer': 'no-answer',
}

/** Selecting this outcome creates a pipeline lead — never silently. */
export const CREATES_LEAD: CanonicalOutcome = 'Interested'

/** Selecting this outcome reveals the follow-up date field. */
export const NEEDS_FOLLOWUP: CanonicalOutcome = 'Follow-up needed'
