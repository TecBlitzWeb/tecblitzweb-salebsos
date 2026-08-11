import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Send } from 'lucide-react'
import clsx from 'clsx'
import { Skeleton } from '../../components/ui/Skeleton'
import { Textarea } from '../../components/ui/Input'
import { EmptyState } from '../../components/shared/EmptyState'
import { ErrorState } from '../../components/shared/ErrorState'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../auth/useAuth'
import { colomboDateTime, formatRelativeDate } from '../../lib/format'
import { displayRepName } from '../../lib/repKey'
import { useSalesUsers, type SalesUser } from '../../api/users'
import { describeReadError, describeWriteError } from '../../api/writeError'
import {
  messageableUsers,
  threadWith,
  useMarkThreadRead,
  useMessages,
  useSendMessage,
  useUnreadCounts,
} from '../../api/messages'

function personName(user: SalesUser): string {
  return user.name?.trim() || displayRepName(user.username) || 'Unknown'
}

/** Unread pill. Semantic colour at 12% alpha behind full-strength text (§4). */
function UnreadPill({ count }: { count: number }) {
  return (
    <span className="ml-auto shrink-0 rounded-sm bg-brand/12 px-2 py-0.5 text-xs font-medium tabular-nums text-brand">
      {count}
    </span>
  )
}

/**
 * Direct messages: conversation list beside the thread on desktop, one at a time
 * on mobile.
 *
 * Reps can only reach the CEO and Co-CEO. That is enforced by the messages INSERT
 * policy; the list here mirrors it so nobody is offered a conversation the
 * database would refuse.
 */
export function MessagesPage() {
  const { user, role } = useAuth()
  const me = user?.id ?? ''
  const salesUsers = useSalesUsers()
  const messages = useMessages()
  const send = useSendMessage()
  const { mutate: markThreadRead } = useMarkThreadRead()
  const { bySender } = useUnreadCounts()
  const { showToast } = useToast()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const contacts = useMemo(
    () => messageableUsers(salesUsers.data ?? [], role, me),
    [salesUsers.data, role, me]
  )

  const active = contacts.find((c) => c.auth_user_id === activeId) ?? null
  const thread = useMemo(
    () => (activeId && me ? threadWith(messages.data ?? [], me, activeId) : []),
    [messages.data, me, activeId]
  )

  /*
    Opening a thread is what marks it read. Guarded on the unread count so the
    twenty-second poll doesn't re-fire an update that would touch zero rows.
  */
  useEffect(() => {
    if (!activeId || !me) return
    if ((bySender.get(activeId) ?? 0) === 0) return
    markThreadRead({ me, them: activeId })
  }, [activeId, me, bySender, markThreadRead])

  // Land on the newest message, both on open and as new ones arrive.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread.length, activeId])

  async function submit() {
    const body = draft.trim()
    if (!body || !activeId || !me) return
    setDraft('')
    try {
      await send.mutateAsync({ senderId: me, recipientId: activeId, body })
    } catch (error) {
      setDraft(body)
      showToast({ message: describeWriteError(error, 'send this message'), tone: 'error' })
    }
  }

  if (messages.isLoading || salesUsers.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full max-w-sm" />
        <Skeleton className="h-14 w-full max-w-sm" />
      </div>
    )
  }

  if (messages.error) {
    return (
      <ErrorState
        {...describeReadError(messages.error, 'messages')}
        onRetry={() => void messages.refetch()}
      />
    )
  }

  /*
    An empty roster here is not "no messages" — it means the sales_users read came
    back without the people this person is allowed to write to, which is a real
    condition worth naming rather than rendering an empty column (§8).
  */
  if (contacts.length === 0) {
    return (
      <EmptyState message="Nobody to message. Your team roster came back empty, so ask the CEO to check your account." />
    )
  }

  return (
    // Fixed to the viewport minus the top bar, page padding and the mobile tab
    // bar, so the thread scrolls inside itself and the composer stays put.
    <div className="flex h-[calc(100dvh-9rem)] gap-4 lg:h-[calc(100vh-6rem)]">
      <aside
        className={clsx(
          'flex w-full min-w-0 flex-col overflow-y-auto rounded-md border border-border bg-surface lg:w-72 lg:shrink-0',
          active && 'hidden lg:flex'
        )}
      >
        <ul>
          {contacts.map((person) => {
            const id = person.auth_user_id as string
            const unread = bySender.get(id) ?? 0
            const isActive = id === activeId
            const latest = me ? threadWith(messages.data ?? [], me, id).at(-1) : undefined

            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setActiveId(id)}
                  aria-current={isActive || undefined}
                  className={clsx(
                    'focus-ring flex min-h-[56px] w-full items-center gap-2 border-b border-border px-3 py-2 text-left transition-colors duration-[120ms] last:border-b-0 motion-reduce:transition-none',
                    isActive ? 'bg-brand-ghost' : 'hover:bg-surface-2'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={clsx(
                          'truncate text-sm',
                          unread > 0 ? 'font-medium text-text' : 'text-text'
                        )}
                      >
                        {personName(person)}
                      </span>
                      <span className="shrink-0 text-2xs text-text-subtle">
                        {(person.role ?? '').trim() || '—'}
                      </span>
                    </div>
                    <p className="truncate text-2xs text-text-subtle">
                      {latest
                        ? `${latest.sender_id === me ? 'You: ' : ''}${latest.body}`
                        : 'No messages yet'}
                    </p>
                  </div>
                  {unread > 0 && <UnreadPill count={unread} />}
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <section
        className={clsx(
          'flex min-w-0 flex-1 flex-col rounded-md border border-border bg-surface',
          !active && 'hidden lg:flex'
        )}
      >
        {!active ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="text-sm text-text-subtle">Pick a conversation to read it.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <button
                type="button"
                aria-label="Back to conversations"
                onClick={() => setActiveId(null)}
                className="focus-ring -ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-text-muted hover:bg-surface-2 hover:text-text lg:hidden"
              >
                <ChevronLeft size={20} strokeWidth={1.75} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{personName(active)}</p>
                <p className="text-2xs text-text-subtle">
                  {(active.role ?? '').trim() || 'No role'}
                </p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
              {thread.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-subtle">
                  No messages yet. Write the first one.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {thread.map((m) => {
                    const mine = m.sender_id === me
                    const when = m.created_at ? new Date(m.created_at) : null

                    return (
                      <li
                        key={m.id}
                        className={clsx('flex flex-col', mine ? 'items-end' : 'items-start')}
                      >
                        <div
                          className={clsx(
                            'max-w-[85%] rounded-md border px-3 py-2 sm:max-w-[70%]',
                            mine
                              ? 'border-brand/30 bg-brand-ghost'
                              : 'border-border bg-surface-2'
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm text-text">
                            {m.body}
                          </p>
                        </div>
                        {/* Sender name and time, never invented — an unstamped row says so. */}
                        <p className="mt-0.5 px-1 text-2xs text-text-subtle">
                          {mine ? 'You' : personName(active)}
                          {when
                            ? ` · ${formatRelativeDate(when)} ${colomboDateTime(when).time}`
                            : ' · time unknown'}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-end gap-2 border-t border-border p-3">
              <Textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends, Shift+Enter breaks the line — this is a chat box,
                  // not a form field.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void submit()
                  }
                }}
                placeholder={`Message ${personName(active)}`}
                aria-label={`Message ${personName(active)}`}
                className="min-h-9"
              />
              <button
                type="button"
                aria-label="Send message"
                disabled={!draft.trim() || send.isPending}
                onClick={() => void submit()}
                className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-brand text-on-brand transition-colors duration-[120ms] hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                <Send size={16} strokeWidth={1.75} />
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
