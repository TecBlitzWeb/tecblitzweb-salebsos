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
  /** `wa.me` wants digits only, no leading 0, prefixed with the country code. */
  whatsapp: string
}

export function toPhoneLink(raw: string): PhoneLink {
  const digits = raw.replace(/\D/g, '')
  return {
    raw,
    tel: digits,
    whatsapp: `94${digits.replace(/^0/, '')}`,
  }
}

/**
 * The comparable form of a number for search. Digit stripping is
 * [toPhoneLink]'s — this is deliberately not a second copy of that regex — and
 * the one leading `0` *or* `94` is then dropped so the same subscriber number
 * reduces to one key no matter which way it was stored:
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
 * A stored value may hold two numbers separated by "/" (`splitPhones` in
 * api/prospects). Split first, then map every part through here: a row with two
 * numbers must be findable by either.
 */
export function phoneSearchKey(raw: string): string {
  return toPhoneLink(raw).tel.replace(/^(?:94|0)/, '')
}
