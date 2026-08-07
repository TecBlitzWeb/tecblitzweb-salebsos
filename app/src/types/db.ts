/**
 * Row shapes as they actually exist in production, probed 2 Aug 2026.
 * See SALESOS_V2_SPEC.md §7 "Column authority" before changing anything here —
 * several near-duplicate columns are dead and must never be read.
 */

export interface ProspectRow {
  id: string
  name: string | null
  type: string | null
  area: string | null
  /** Free text. May hold two numbers separated by "/". */
  phone: string | null
  assignedto: string | null
  /** Free text with the value embedded, e.g. "Landing Page - 65000". */
  pkg: string | null
  /** The pain-point field. This is the prospect's notes; there is no `notes` column. */
  pain: string | null
  script: string | null
  favourite: boolean | null
  /** Authoritative on prospects (677/677). */
  created_at: string | null
  updated_at: string | null
  createdby: string | null
  createdBy: string | null
}

export interface CallRow {
  id: string
  /** Joins prospects.name by text. No FK, duplicates exist. */
  prospect: string | null
  rep: string | null
  outcome: string | null
  notes: string | null
  phone: string | null
  /** Display only — text, never sort on it. */
  date: string | null
  /** Display only — text, never sort on it. */
  time: string | null
  duration: number | null
  followup: string | null
  /** Authoritative on calls (1074/1074). Dead on prospects — see §7. */
  createdat: string | null
}

export const PROSPECT_COLUMNS =
  'id,name,type,area,phone,assignedto,pkg,pain,script,favourite,created_at,updated_at,createdby,createdBy'

export const CALL_COLUMNS =
  'id,prospect,rep,outcome,notes,phone,date,time,duration,followup,createdat'
