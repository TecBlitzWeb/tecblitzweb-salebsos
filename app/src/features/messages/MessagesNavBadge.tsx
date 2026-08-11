import { useUnreadCounts } from '../../api/messages'

/**
 * Unread count for the Messages nav item, in the sidebar and the mobile menu.
 *
 * Rendered through `NavItem.badge` so the layout stays unaware of what it is
 * showing — no component in components/layout needs to know that messages exist,
 * and nothing there compares a path to a literal to decide where this goes.
 *
 * Reads the same polled query the page does, so the number here and the pills in
 * the conversation list are always the same fact.
 */
export function MessagesNavBadge() {
  const { total } = useUnreadCounts()
  if (total === 0) return null

  return (
    <span
      aria-label={`${total} unread ${total === 1 ? 'message' : 'messages'}`}
      className="ml-auto min-w-5 shrink-0 rounded-sm bg-brand/12 px-1.5 text-center text-2xs font-medium leading-4 tabular-nums text-brand"
    >
      {total > 99 ? '99+' : total}
    </span>
  )
}
