/**
 * The one place a stored phone number is turned into a `tel:`/`wa.me` pair.
 * `prospects.phone` (and by extension a call's copy of it) may hold two
 * numbers joined by "/" — always split first (`splitPhones` in api/prospects)
 * and map every result through this. Never take just the first: a row with
 * two numbers must offer both, not silently drop one.
 */
export interface PhoneLink {
  /** As stored, trimmed. E.g. "0771234567". */
  raw: string
  /** `tel:` wants the local dialling form exactly as a Sri Lankan phone is dialled. */
  tel: string
  /** `wa.me` wants E.164 without the `+`: country code then the 9-digit national number. */
  whatsapp: string
}

/** Every digit, no separators. The one place `\D` is stripped. */
function digitsOf(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * The national significant number — the 9 digits that identify the subscriber,
 * with whichever trunk or country prefix the row happened to be stored with
 * removed. `94` is tested before `0` because a number stored as "+94 76 …"
 * carries no trunk 0 to strip, and stripping only the 0 (as this once did)
 * left the country code in place to be prefixed a second time: "9494760807700".
 *
 *   "0760807700"      → "760807700"
 *   "+94 76 080 7700" → "760807700"
 *   "0114 005 611"    → "114005611"
 */
function nationalNumber(raw: string): string {
  return digitsOf(raw).replace(/^(?:94|0)/, '')
}

/**
 * Sri Lankan national numbers are exactly 9 digits — 2-digit area or mobile
 * prefix plus 7. Anything shorter is a truncated or junk entry, not a number a
 * link could reach.
 */
const NATIONAL_DIGITS = 9

/**
 * One already-split segment in, one set of links out — this does not split, and
 * must not: see the note above about rows holding two numbers.
 *
 * Returns null when the segment can't yield a dialable number, so the caller
 * renders a disabled control instead of a link that opens WhatsApp on a number
 * that cannot exist.
 */
export function toPhoneLink(raw: string): PhoneLink | null {
  const national = nationalNumber(raw)
  if (national.length < NATIONAL_DIGITS) return null
  return {
    raw,
    tel: digitsOf(raw),
    whatsapp: `94${national}`,
  }
}

/**
 * The comparable form of a number for search: [nationalNumber] and nothing
 * else, so the same subscriber number reduces to one key no matter which way it
 * was stored:
 *
 *   "076 433 0350"      → "764330350"
 *   "+94 76 080 7700"   → "760807700"
 *   "0114 005 611"      → "114005611"
 *
 * Both the stored value and the typed query go through this, which is why a
 * query of "0760807700" finds a row stored as "+94 76 080 7700", and why a
 * partial like "7375" still substring-matches — neither side is padded back
 * out to a canonical length.
 *
 * Deliberately not routed through [toPhoneLink]: that rejects anything under 9
 * digits, and a partial query is the normal case here.
 *
 * A stored value may hold two numbers separated by "/" (`splitPhones` in
 * api/prospects). Split first, then map every part through here: a row with two
 * numbers must be findable by either.
 */
export function phoneSearchKey(raw: string): string {
  return nationalNumber(raw)
}
