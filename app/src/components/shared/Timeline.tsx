import clsx from 'clsx'
import { OUTCOME_META, StatusChip, type CallOutcome } from './StatusChip'
import { formatListDate } from '../../lib/format'

export interface TimelineEntry {
  id: string
  date: Date
  time: string
  rep: string
  outcome: CallOutcome
  note?: string
}

interface TimelineProps {
  entries: TimelineEntry[]
}

/**
 * §6b call history — the heart of the detail panel. Dot in the outcome colour,
 * date, time, rep, chip, then the note. Notes are frequently Sinhala or
 * romanized Sinhala, so the note line inherits the body stack's fallback.
 */
export function Timeline({ entries }: TimelineProps) {
  return (
    <ol className="flex flex-col">
      {entries.map((entry, i) => {
        const last = i === entries.length - 1
        return (
          <li key={entry.id} className="flex gap-3">
            <div className="flex flex-col items-center pt-1.5">
              <span
                aria-hidden="true"
                className={clsx('h-2 w-2 shrink-0 rounded-full', OUTCOME_META[entry.outcome].dotClass)}
              />
              {!last && <span aria-hidden="true" className="w-px flex-1 bg-border" />}
            </div>

            <div className={clsx('min-w-0 flex-1', last ? 'pb-0' : 'pb-4')}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-2xs tabular-nums text-text-muted">
                  {formatListDate(entry.date)}
                </span>
                <span className="text-2xs tabular-nums text-text-subtle">{entry.time}</span>
                <span className="text-2xs text-text-muted">{entry.rep}</span>
                <StatusChip outcome={entry.outcome} />
              </div>
              {entry.note && <p className="mt-1 text-sm text-text">{entry.note}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
