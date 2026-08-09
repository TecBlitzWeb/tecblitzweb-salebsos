import { useMemo } from 'react'
import { useFollowups, type FollowupItem } from '../followups/useFollowups'
import { useProspectViews, type ProspectView } from '../prospects/useProspectList'
import { canonicalRepKey } from '../../lib/repKey'

export type ActionKind = 'overdue' | 'due-today' | 'never-called'

export interface ActionItem {
  id: string
  name: string
  /** Every number on the row — a row with two must offer both, never just the first. */
  phones: string[]
  kind: ActionKind
  reasonLabel: string
  /** Always present — `useFollowups(repKey, false)` already excludes orphans. */
  prospect: ProspectView | null
  followup: FollowupItem | null
}

const MAX_ITEMS = 10

function reasonLabel(kind: ActionKind, days: number): string {
  if (kind === 'overdue') return `Overdue ${days} ${days === 1 ? 'day' : 'days'}`
  if (kind === 'due-today') return 'Follow-up due today'
  return 'Never called'
}

/**
 * The prospect join (when it resolved) already carries every "/"-split
 * number; `calls.phone` is a single free-text field and is only a fallback
 * for the rare orphaned-but-shown case.
 */
function phonesFor(item: FollowupItem): string[] {
  if (item.prospect && item.prospect.phones.length > 0) return item.prospect.phones
  const fallback = (item.call.phone ?? '').trim()
  return fallback ? [fallback] : []
}

function fromFollowup(kind: ActionKind, item: FollowupItem): ActionItem {
  return {
    id: `followup:${item.call.id}`,
    name: item.call.prospect || 'Unknown business',
    phones: phonesFor(item),
    kind,
    reasonLabel: reasonLabel(kind, item.daysOverdue),
    prospect: item.prospect,
    followup: item,
  }
}

/**
 * The page's hero (SPEC §5.1, DESIGN_RULES §7): overdue follow-ups first, then
 * today's, then this rep's never-called assigned prospects — capped at 10.
 * `followupsDue` is the *uncapped* count of overdue + today combined (orphans
 * already excluded via `useFollowups(repKey, false)`) — the same two buckets
 * the Action queue itself draws from, from the same `useFollowups` call the
 * Follow-ups page uses. It must not be `items.length`: that number is capped
 * at 10 and also mixes in never-called prospects, which are not follow-ups.
 */
export function useActionQueue(repKey: string) {
  // Orphaned calls are excluded — there is no prospect to call, so they
  // cannot be an action (SPEC §0.14). Matches Follow-ups' own default.
  const followups = useFollowups(repKey, false)
  const { views, isLoading: viewsLoading, error: viewsError } = useProspectViews()

  const neverCalled = useMemo(() => {
    const mine = views.filter(
      (v) => canonicalRepKey(v.row.assignedto).trim() === repKey && v.daysSinceLastCall === null
    )
    // Longest-neglected first: oldest-added prospects have waited longest.
    return [...mine].sort(
      (a, b) => Date.parse(a.row.created_at ?? '') - Date.parse(b.row.created_at ?? '')
    )
  }, [views, repKey])

  const items = useMemo<ActionItem[]>(() => {
    const overdue = followups.buckets.overdue.map((f) => fromFollowup('overdue', f))
    const dueToday = followups.buckets.today.map((f) => fromFollowup('due-today', f))
    const cold = neverCalled.map<ActionItem>((v) => ({
      id: `prospect:${v.row.id}`,
      name: v.row.name || 'Unnamed',
      phones: v.phones,
      kind: 'never-called',
      reasonLabel: reasonLabel('never-called', 0),
      prospect: v,
      followup: null,
    }))

    return [...overdue, ...dueToday, ...cold].slice(0, MAX_ITEMS)
  }, [followups.buckets, neverCalled])

  return {
    items,
    followupsDue: followups.buckets.overdue.length + followups.buckets.today.length,
    isLoading: followups.isLoading || viewsLoading,
    error: followups.error ?? viewsError ?? null,
    refetch: followups.refetch,
  }
}
