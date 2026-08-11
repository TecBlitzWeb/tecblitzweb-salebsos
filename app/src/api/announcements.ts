import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AnnouncementRow } from '../types/db'
import { ANNOUNCEMENT_COLUMNS } from '../types/db'
import { fetchAllRows, toSupabaseError } from './supabaseQuery'
import { supabase } from '../lib/supabase'

export const ANNOUNCEMENTS_QUERY_KEY = ['announcements', 'all'] as const

/**
 * Every announcement, newest first. The SELECT policy is `true` for everyone, so
 * there is no rep filter here and there must not be one — a rep reads the same
 * rows the CEO does.
 *
 * Paged like every other full-table read. Nine announcements fit in one page
 * today; an unpaged select is a truncation waiting to happen.
 */
export function useAnnouncements() {
  return useQuery({
    queryKey: ANNOUNCEMENTS_QUERY_KEY,
    queryFn: () =>
      fetchAllRows<AnnouncementRow>('announcements', ANNOUNCEMENT_COLUMNS, 'created_at'),
    staleTime: 60_000,
  })
}

/**
 * Posts an announcement.
 *
 * `author_id` must be the caller's own auth uid: the INSERT policy is
 * `can_announce() AND author_id = auth.uid()`, so a missing or borrowed id is a
 * 403, not a mis-attributed row. It is passed in rather than read from the
 * session in here so the caller can't accidentally post as nobody.
 *
 * Not optimistic: `id` is a database-assigned bigint, and inventing one to show
 * the row a frame earlier means either a fake id in the cache or a client-side
 * guess at a sequence. The list refetches instead.
 *
 * `created_at` is written explicitly rather than relying on a column default,
 * because the sort in [useAnnouncements] is that column — a null there would put
 * a brand-new post at the bottom.
 */
export function useAddAnnouncement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ body, authorId }: { body: string; authorId: string }) => {
      const { data, error, status } = await supabase
        .from('announcements')
        .insert({ body: body.trim(), author_id: authorId, created_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw toSupabaseError(error, status)
      return data as AnnouncementRow
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY })
    },
  })
}

/**
 * A real delete — announcements have no tombstone column. RLS restricts this to
 * CEO and Co-CEO; the UI hides the control from everyone else, and a rep who
 * reaches it anyway gets a 403 rather than a silent no-op.
 */
export function useDeleteAnnouncement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const { error, status } = await supabase.from('announcements').delete().eq('id', id)
      if (error) throw toSupabaseError(error, status)
      return { id }
    },

    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY })
      const previous = queryClient.getQueryData<AnnouncementRow[]>(ANNOUNCEMENTS_QUERY_KEY)
      queryClient.setQueryData<AnnouncementRow[]>(ANNOUNCEMENTS_QUERY_KEY, (old) =>
        (old ?? []).filter((a) => a.id !== id)
      )
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ANNOUNCEMENTS_QUERY_KEY, context.previous)
      }
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY })
    },
  })
}
