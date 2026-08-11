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
  /**
   * Soft-delete tombstone, added 11 Aug 2026. Non-null means the row sits in the
   * trash and must not appear in any list, count, stat, filter or search — every
   * read goes through `isLive` in api/prospects.ts. Nullable with no default, so
   * a row inserted without it is live.
   */
  deleted_at: string | null
}

/**
 * There is no `title` column — the body is the whole announcement. Confirmed
 * against production 11 Aug 2026; anything rendering a heading here is inventing
 * one.
 *
 * `id` is a bigint, so it arrives as a JS number, unlike prospects' text ids.
 * `author_id` is an auth user uuid and joins `sales_users.auth_user_id`, not
 * `sales_users.id`.
 */
export interface AnnouncementRow {
  id: number
  body: string
  author_id: string | null
  created_at: string | null
}

export const ANNOUNCEMENT_COLUMNS = 'id,body,author_id,created_at'

/**
 * A direct message between two staff members.
 *
 * `sender_id` and `recipient_id` are auth user uuids, joining
 * `sales_users.auth_user_id` — not the bigint `sales_users.id`. `id` is a uuid
 * the client generates, so a send can be optimistic without guessing a sequence.
 *
 * `read_at` is null until the *recipient* opens the thread; the UPDATE policy
 * lets only the recipient set it, so a sender can never mark their own message
 * read.
 */
export interface MessageRow {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  created_at: string | null
  read_at: string | null
}

export const MESSAGE_COLUMNS = 'id,sender_id,recipient_id,body,created_at,read_at'

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
  /**
   * A DATE held as text, `yyyy-MM-dd`. Not a note. Never cleared to mark a
   * follow-up complete — that is what `followup_done` is for.
   */
  followup: string | null
  /**
   * `not null default false`. Completing a follow-up flips this; the date in
   * `followup` is preserved forever so "what was due on that day" stays
   * answerable. Must stay in CALL_COLUMNS: if it is not selected it reads
   * `undefined`, which is falsy, so every row would look not-done and the
   * counts would be plausible and wrong.
   */
  followup_done: boolean
  /** Authoritative on calls (every row). Dead on prospects — see §7. */
  createdat: string | null
}

/**
 * Nine columns, not the five listed in SALESOS_V2_SPEC.md §7 — that line is
 * incomplete and `biz`, `pkg`, `"leadId"` and `source` were missing from it.
 * All four are required: a deal row without `biz` and `pkg` cannot tell Phase 9
 * Revenue what was sold or to whom, and without `"leadId"` revenue cannot be
 * traced back to the lead it closed from.
 */
export interface ClosedDealRow {
  id: string
  /** Business name — this table's equivalent of `prospects.name` / `interested_leads.lead`. */
  biz: string | null
  /**
   * Postgres `numeric`. PostgREST normally returns this as a JSON number, but
   * numeric can arrive as a string when precision would be lost — verify against
   * real rows before Phase 9 sums this column.
   */
  value: number | null
  rep: string | null
  /**
   * Display-only text, `yyyy-MM-dd`. Never bucket time on this column —
   * `created_at` is the authoritative instant.
   */
  date: string | null
  /** Free text with the value embedded, same shape as `prospects.pkg`. */
  pkg: string | null
  /**
   * The `interested_leads.id` this deal closed from, so revenue traces back to
   * its lead. Quoted camelCase in SQL, exactly like `interested_leads."createdAt"`.
   */
  leadId: string | null
  source: string | null
  /** Authoritative timestamptz — the only column anything time-based reads. */
  created_at: string | null
}

/**
 * Twenty columns, verified against production 8 Aug 2026.
 *
 * There is **no `lead` column** — the business name is `biz`. An earlier version
 * of this file had `lead`, which PostgREST rejects with a 400; SPEC §7's old
 * line was wrong the same way it was wrong about `closed_deals`.
 *
 * There is **no value column**. A deal's value has exactly one source: the Won
 * sheet asks for it. v1 defaulted to a hardcoded 120000 and invented revenue.
 *
 * Every date here is TEXT except `updated_at`. Nothing time-based may assume a
 * real timestamp — parse explicitly through `parseLeadDate` (api/leads.ts).
 */
export interface InterestedLeadRow {
  id: string
  /** Business name. Joins `prospects.name` by text, like `calls.prospect`. */
  biz: string | null
  rep: string | null
  /** TEXT date. */
  callDate: string | null
  callNotes: string | null
  phone: string | null
  /** Free text with the value embedded, same shape as `prospects.pkg`. */
  pkg: string | null
  bizType: string | null
  /** Drives the kanban columns: `new` | `pending` | `called` | `won` | `lost`. */
  status: string | null
  mockupNotes: string | null
  mockupUrl: string | null
  mockupSentBy: string | null
  /** TEXT timestamp — when the lead entered "Mockup sent". */
  mockupSentAt: string | null
  callbackNotes: string | null
  /** `won` | `lost` | `followup`, written alongside a callback (v1 index.html:13792). */
  callbackOutcome: string | null
  /** TEXT timestamp — when the lead entered "Callback". */
  callbackAt: string | null
  /** TEXT timestamp — when the lead was created. Not a real timestamptz. */
  createdAt: string | null
  sourceCallId: string | null
  advance_cleared: boolean | null
  /** The only genuine timestamptz on this table. */
  updated_at: string | null
}

export const PROSPECT_COLUMNS =
  'id,name,type,area,phone,assignedto,pkg,pain,script,favourite,created_at,updated_at,createdby,createdBy,deleted_at'

export const CALL_COLUMNS =
  'id,prospect,rep,outcome,notes,phone,date,time,duration,followup,followup_done,createdat'

/**
 * `leadId` is written bare here, matching `createdAt` in INTERESTED_LEAD_COLUMNS:
 * PostgREST parses each name out of this list and emits a quoted identifier, so
 * case is preserved without literal quotes in the string. Unverified against
 * production — if either column comes back missing, quoting it here (`"leadId"`)
 * is the fix.
 */
export const CLOSED_DEAL_COLUMNS = 'id,biz,value,rep,date,pkg,leadId,source,created_at'

/**
 * All twenty columns. The previous value selected `lead`, which does not exist —
 * PostgREST 400s on an unknown column, so Today's "Interested created" card was
 * erroring rather than counting. camelCase names are bare here for the same
 * reason as `leadId` above: PostgREST quotes each identifier itself.
 */
export const INTERESTED_LEAD_COLUMNS =
  'id,biz,rep,callDate,callNotes,phone,pkg,bizType,status,mockupNotes,mockupUrl,mockupSentBy,mockupSentAt,callbackNotes,callbackOutcome,callbackAt,createdAt,sourceCallId,advance_cleared,updated_at'
