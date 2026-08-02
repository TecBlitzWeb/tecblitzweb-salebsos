/**
 * Temperature tiers (DESIGN_RULES §1) — days since last contact.
 * This is the product's signature element, so the thresholds live in exactly
 * one place and every surface that shows temperature reads from here.
 */
export type TemperatureTier = 'never' | 'warm' | 'cooling' | 'cold' | 'dead'

export interface TemperatureMeta {
  tier: TemperatureTier
  label: string
  /** Tailwind background utility for the 3px bar. */
  barClass: string
}

const META: Record<TemperatureTier, TemperatureMeta> = {
  never: { tier: 'never', label: 'Never called', barClass: 'bg-brand' },
  warm: { tier: 'warm', label: 'Warm', barClass: 'bg-success' },
  cooling: { tier: 'cooling', label: 'Cooling', barClass: 'bg-warning' },
  cold: { tier: 'cold', label: 'Cold', barClass: 'bg-cold' },
  dead: { tier: 'dead', label: 'Dead unless rescued', barClass: 'bg-danger' },
}

/** `null` days means the prospect has never been called. */
export function temperatureTier(daysSinceLastCall: number | null): TemperatureTier {
  if (daysSinceLastCall === null) return 'never'
  if (daysSinceLastCall <= 2) return 'warm'
  if (daysSinceLastCall <= 7) return 'cooling'
  if (daysSinceLastCall <= 21) return 'cold'
  return 'dead'
}

export function temperatureMeta(daysSinceLastCall: number | null): TemperatureMeta {
  return META[temperatureTier(daysSinceLastCall)]
}

export const ALL_TEMPERATURE_TIERS: TemperatureMeta[] = [
  META.never,
  META.warm,
  META.cooling,
  META.cold,
  META.dead,
]
