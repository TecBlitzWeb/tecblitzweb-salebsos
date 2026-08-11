import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MessageRow } from '../types/db'
import { MESSAGE_COLUMNS } from '../types/db'
import { fetchAllRows, toSupabaseError } from './supabaseQuery'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

export const MESSAGES_QUERY_KEY = ['messages', 'all'] as const

/**
 * How often the client asks for new messages. Polling, not realtime: a
 * subscription is a second transport to keep alive, reconnect and reason about,
 * and this is a nine-person team where a message arriving within twenty seconds
 * is indistinguishable from instant.
 */
const POLL_MS = 20_000

/**
 * Every message involving me, in one query.
 *
 * The SELECT policy is `sender or recipient is me`, so this is already my mail
 * and nothing else — there is no app-side filter here and there must not be one.
 * Threads are sliced out of this single cached list client-side, which is why
 * switching conversations costs no request.
 *
 * Ordered newest-first by the shared pager; [threadWith] re-sorts ascending
 * because a conversation reads oldest-first.
 */
export function useMessages() {
  return useQuery({
    queryKey: MESSAGES_QUERY_KEY,
    queryFn: () => fetchAllRows<MessageRow>('messages', MESSAGE_COLUMNS, 'created_at'),
    staleTime: 10_000,
    refetchInterval: POLL_MS,
  })
}

/** One conversation, oldest first. `them` is the other person's auth uuid. */
export function threadWith(rows: MessageRow[], me: string, them: string): MessageRow[] {
  return rows
    .filter(
      (m) =>
        (m.sender_id === me && m.recipient_id === them) ||
        (m.sender_id === them && m.recipient_id === me)
    )
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
}

/**
 * Who this person is allowed to hold a conversation with.
 *
 * A rep gets exactly the CEO and Co-CEO and cannot start anything else — that is
 * the INSERT policy's rule, mirrored here so the UI never offers a recipient the
 * database would reject with a 403. A CEO or Co-CEO gets the whole roster.
 *
 * Self is excluded in both cases: a thread with yourself is not a feature, and
 * the roster is 9 people so a manager sees the other 8.
 *
 * Anyone without an `auth_user_id` is dropped — messages are addressed by auth
 * uuid, so there is no way to send to a roster row that has never signed in.
 */
export function messageableUsers<T extends { auth_user_id: string | null; role: string | null }>(
  users: T[],
  myRole: string | null,
  myAuthId: string
): T[] {
  const iAmManager = myRole === 'CEO' || myRole === 'Co-CEO'
  return users.filter((u) => {
    if (!u.auth_user_id || u.auth_user_id === myAuthId) return false
    if (iAmManager) return true
    const role = (u.role ?? '').trim()
    return role === 'CEO' || role === 'Co-CEO'
  })
}

export interface UnreadCounts {
  /** Unread messages I have received, keyed by the sender's auth uuid. */
  bySender: Map<string, number>
  total: number
}

/**
 * Unread means: addressed to me, and not yet stamped `read_at`. Messages I sent
 * never count, however long the other side takes to open them.
 *
 * Derived from the same cached list the page renders, so the nav badge and the
 * per-conversation badges can never disagree.
 */
export function useUnreadCounts(): UnreadCounts {
  const { user } = useAuth()
  const { data } = useMessages()
  const me = user?.id ?? ''

  return useMemo(() => {
    const bySender = new Map<string, number>()
    let total = 0
    if (!me) return { bySender, total }

    for (const m of data ?? []) {
      if (m.recipient_id !== me || m.read_at) continue
      bySender.set(m.sender_id, (bySender.get(m.sender_id) ?? 0) + 1)
      total += 1
    }
    return { bySender, total }
  }, [data, me])
}

/**
 * Sends a message.
 *
 * The INSERT policy is `sender is me AND (I am CEO/Co-CEO OR the recipient is)`,
 * so a rep messaging another rep is refused by the database. The UI only ever
 * offers recipients that policy would accept — it is not the thing enforcing it.
 *
 * Optimistic, because `id` is a client-generated uuid (SPEC §0.9): the message
 * appears in the thread on the frame it is sent, with no invented server state.
 */
export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vars: { senderId: string; recipientId: string; body: string }) => {
      const row: MessageRow = {
        id: crypto.randomUUID(),
        sender_id: vars.senderId,
        recipient_id: vars.recipientId,
        body: vars.body.trim(),
        created_at: new Date().toISOString(),
        read_at: null,
      }
      const { data, error, status } = await supabase
        .from('messages')
        .insert(row)
        .select()
        .single()
      if (error) throw toSupabaseError(error, status)
      return (data ?? row) as MessageRow
    },

    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: MESSAGES_QUERY_KEY })
      const previous = queryClient.getQueryData<MessageRow[]>(MESSAGES_QUERY_KEY)
      const optimistic: MessageRow = {
        id: crypto.randomUUID(),
        sender_id: vars.senderId,
        recipient_id: vars.recipientId,
        body: vars.body.trim(),
        created_at: new Date().toISOString(),
        read_at: null,
      }
      queryClient.setQueryData<MessageRow[]>(MESSAGES_QUERY_KEY, (old) => [
        optimistic,
        ...(old ?? []),
      ])
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(MESSAGES_QUERY_KEY, context.previous)
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
    },
  })
}

/**
 * Stamps `read_at` on every unread message this person sent me.
 *
 * Scoped to `recipient_id = me` as well as the sender, because the UPDATE policy
 * allows only the recipient to write this column — without that predicate the
 * statement would try to touch my own outgoing messages and be refused.
 *
 * `.is('read_at', null)` keeps it idempotent: re-opening a thread updates zero
 * rows rather than rewriting timestamps that were already set.
 */
export function useMarkThreadRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ me, them }: { me: string; them: string }) => {
      const iso = new Date().toISOString()
      const { error, status } = await supabase
        .from('messages')
        .update({ read_at: iso })
        .eq('recipient_id', me)
        .eq('sender_id', them)
        .is('read_at', null)
      if (error) throw toSupabaseError(error, status)
      return { me, them, read_at: iso }
    },

    onMutate: async ({ me, them }) => {
      await queryClient.cancelQueries({ queryKey: MESSAGES_QUERY_KEY })
      const previous = queryClient.getQueryData<MessageRow[]>(MESSAGES_QUERY_KEY)
      const iso = new Date().toISOString()
      queryClient.setQueryData<MessageRow[]>(MESSAGES_QUERY_KEY, (old) =>
        (old ?? []).map((m) =>
          m.recipient_id === me && m.sender_id === them && !m.read_at
            ? { ...m, read_at: iso }
            : m
        )
      )
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(MESSAGES_QUERY_KEY, context.previous)
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
    },
  })
}
