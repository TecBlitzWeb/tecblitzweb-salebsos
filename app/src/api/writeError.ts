import { SupabaseError } from '../lib/queryClient'

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
