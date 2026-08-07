import { useRef, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import clsx from 'clsx'
import { TemperatureBar } from '../../components/shared/TemperatureBar'
import { StatusChip } from '../../components/shared/StatusChip'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { displayRepName } from '../../lib/repKey'
import { formatListDate } from '../../lib/format'
import { toOutcome } from '../prospects/ProspectRow'
import type { FollowupItem } from './useFollowups'

const SNOOZE = [
  { label: '+1d', days: 1 },
  { label: '+3d', days: 3 },
  { label: '+1w', days: 7 },
]

/** Past this distance the gesture commits; below it the row springs back. */
const SWIPE_COMMIT_PX = 72

interface FollowupRowProps {
  item: FollowupItem
  onSnooze: (item: FollowupItem, days: number) => void
  onSnoozeTo: (item: FollowupItem, date: string) => void
  onDone: (item: FollowupItem) => void
  onOpen: (item: FollowupItem) => void
}

export function FollowupRow({ item, onSnooze, onSnoozeTo, onDone, onOpen }: FollowupRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [pickDate, setPickDate] = useState(item.due)
  const [dx, setDx] = useState(0)
  const startX = useRef<number | null>(null)

  const { call, prospect, daysOverdue, bucket } = item
  const linked = prospect !== null

  // Right = snooze, left = mark done (§7). Pointer events cover touch and mouse.
  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startX.current === null) return
    setDx(e.clientX - startX.current)
  }
  function onPointerUp() {
    if (startX.current === null) return
    if (dx > SWIPE_COMMIT_PX) onSnooze(item, 1)
    else if (dx < -SWIPE_COMMIT_PX) onDone(item)
    startX.current = null
    setDx(0)
  }

  const overdueLabel =
    bucket === 'overdue'
      ? `${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} overdue`
      : bucket === 'today'
        ? 'Due today'
        : `Due ${formatListDate(new Date(`${item.due}T00:00:00`))}`

  return (
    <li className="relative overflow-hidden rounded-md">
      {/* Gesture affordances revealed as the row slides. */}
      <div className="absolute inset-y-0 left-0 flex items-center gap-1 px-3 text-xs text-warning">
        <Clock size={16} strokeWidth={1.75} />
        Snooze 1 day
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center gap-1 px-3 text-xs text-success">
        Mark done
        <Check size={16} strokeWidth={1.75} />
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // Only the horizontal offset is inline — it changes every pointer frame
        // and cannot be a utility class.
        style={{ transform: `translateX(${dx}px)` }}
        className={clsx(
          'relative flex touch-pan-y border bg-surface',
          dx === 0 && 'transition-transform duration-[120ms] motion-reduce:transition-none',
          bucket === 'overdue' ? 'border-danger/30' : 'border-border'
        )}
      >
        <TemperatureBar daysSinceLastCall={prospect?.daysSinceLastCall ?? null} />

        <div className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              disabled={!linked}
              onClick={() => onOpen(item)}
              title={linked ? 'Open prospect' : 'This call matches no prospect'}
              className={clsx(
                'focus-ring min-w-0 flex-1 truncate rounded-sm text-left text-sm',
                linked ? 'text-text hover:text-brand' : 'cursor-not-allowed text-text-muted'
              )}
            >
              {call.prospect || 'Unknown business'}
            </button>
            {!linked && (
              <span className="shrink-0 rounded-sm bg-warning/12 px-1.5 py-0.5 text-2xs font-medium text-warning">
                Unlinked
              </span>
            )}
            <span
              className={clsx(
                'shrink-0 whitespace-nowrap text-xs tabular-nums',
                bucket === 'overdue'
                  ? 'text-danger'
                  : bucket === 'today'
                    ? 'text-brand'
                    : 'text-text-subtle'
              )}
            >
              {overdueLabel}
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <StatusChip outcome={toOutcome(call.outcome)} />
            <span className="min-w-0 flex-1 truncate text-xs text-text-muted">
              {displayRepName(call.rep)}
            </span>
            <Button size="sm" variant="secondary" onClick={() => setExpanded((v) => !v)}>
              Update
            </Button>
          </div>

          {expanded && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {SNOOZE.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => onSnooze(item, s.days)}
                  className="focus-ring rounded-sm border border-border-strong px-2 py-1 text-xs text-text hover:bg-surface-2"
                >
                  {s.label}
                </button>
              ))}
              <Input
                type="date"
                value={pickDate}
                onChange={(e) => setPickDate(e.target.value)}
                aria-label="Pick a follow-up date"
                className="h-8 w-auto"
              />
              <Button size="sm" variant="secondary" onClick={() => onSnoozeTo(item, pickDate)}>
                Set date
              </Button>
              <Button size="sm" variant="primary" onClick={() => onDone(item)}>
                Mark done
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
