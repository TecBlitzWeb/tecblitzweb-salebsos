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
