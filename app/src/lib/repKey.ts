/**
 * Normalizes a free-text rep name into a stable join key.
 *
 * `prospects.assignedto` and `calls.rep` store free text like `Himanthi2525`,
 * `rashitha`, `Avishka` — same person, different literal strings. This must
 * mirror `public.canonical_rep()` on production byte-for-byte, including its
 * flaws — a client that "cleans up" the input more than the database does
 * will join on a different key and silently drop rows.
 *
 * Verified against the live DB 2 Aug 2026:
 *   select lower(regexp_replace(coalesce(x,''), '[0-9]+$', ''))
 *
 * No trim. Whitespace survives untouched, and `[0-9]+$` only strips digits
 * that are the literal last characters — a trailing space after the digits
 * blocks the match, so "Avishka22 " does NOT lose its digits.
 *
 * This function is not in any repo SQL file. `rls_step3_policies.sql` (which
 * likely defines it) was never run against production, so the function
 * exists on the live DB but nowhere in this repo. Repo SQL is not a reliable
 * description of production — query the DB directly when in doubt.
 */
export function canonicalRepKey(rep: string | null | undefined): string {
  const value = rep ?? ''
  return value.replace(/[0-9]+$/, '').toLowerCase()
}
