import { SupabaseError } from '../lib/queryClient'

/**
 * The read-side counterpart, shaped for `ErrorState`'s props — §8 requires the
 * status code to be on screen. `subject` is a noun phrase ("the trash").
 *
 * An RLS denial on *read* never reaches here: it arrives as 200 with `[]` and
 * belongs in an empty state. Anything landing here is a real failure.
 *
 * `ProspectsPage` and `CommandPalette` predate this and each keep a private copy
 * with prospect-specific wording. New pages use this one.
 */
export function describeReadError(
  error: unknown,
  subject: string
): { message: string; status: number } {
  if (error instanceof SupabaseError) {
    if (error.status === 401) {
      return { message: 'Your session expired. Sign in again to keep working.', status: 401 }
    }
    if (error.status === 403) {
      return {
        message: `You don't have permission to read ${subject}. Ask a CEO to check your role.`,
        status: 403,
      }
    }
    return { message: `Couldn't load ${subject}. Check your connection.`, status: error.status }
  }
  return { message: `Couldn't load ${subject}. Check your connection.`, status: 0 }
}

/**
 * One place that turns a failed write into user-facing words (SPEC §0.5, §7,
 * DESIGN_RULES §8). Every message states what failed, shows the status code
 * when there is one, and makes clear nothing was saved so the action reads as
 * retryable. Nothing here ever returns a success-shaped string.
 *
 * `subject` is a verb phrase ("log this call"), so it is only ever interpolated
 * mid-sentence — never capitalised into a sentence subject, which produced
 * "Log this call was not saved".
 */
export function describeWriteError(error: unknown, subject: string): string {
  if (error instanceof SupabaseError) {
    // RLS refused the write. Postgres reports 42501; PostgREST maps it to 403.
    if (error.status === 403 || error.code === '42501') {
      return `You don't have permission to ${subject} (403). Nothing was saved.`
    }
    if (error.status === 401) {
      return `Your session expired (401). Nothing was saved — sign in and try again.`
    }
    if (error.status === 409) {
      return `That record already exists (409). Nothing was saved.`
    }
    // A status of 0 means the request never reached the server (offline, DNS,
    // aborted). Showing "(0)" tells the user nothing, so omit it.
    if (!error.status) {
      return `Couldn't ${subject}. Nothing was saved — check your connection and try again.`
    }
    return `Couldn't ${subject} (${error.status}). Nothing was saved — try again.`
  }
  return `Couldn't ${subject}. Nothing was saved — check your connection and try again.`
}
