# TecBlitzWeb Sales OS v2 — Full Handoff

Paste this whole file as the first message of a new chat. It contains everything needed to
continue without re-explaining anything.

Last merged: 9 Aug 2026. Absorbs `HANDOFF_ADDENDUM_2026-08-09.md`, which no longer exists —
where the addendum contradicted this file it won, because it was verified against production.

---

## 1. Who I am, what we're building

I'm Bisara, CEO of TecBlitzWeb — a web design agency in Sri Lanka. My team cold-calls local
businesses (hotels, salons, garages, restaurants, law firms) and sells them websites. Nine people:
me (CEO), Avishka (Co-CEO), and seven sales reps — Chamindu, Rashitha, Sandaruwan, Mohammad,
Manoj, Himanthi, Dehami.

**We are rebuilding our internal CRM from scratch.** The old one (v1) still runs the business but
is a 15,118-line single HTML file with 362 functions, built with no spec and no review. It looks
like 2023 and it has data-integrity bugs that cost real money.

**Division of labour:**
- **You** review, diagnose, and write the prompts I paste into Claude Code. You never write app code.
- **Claude Code** builds, in my repo, on branch `v2`.
- **I** run browser tests and SQL, and report results back.

**My style:** short, direct, paste-ready. No theory, no long paragraphs. Be a ruthless mentor —
stress-test everything, tell me plainly when I'm wrong. English isn't my first language; I write
in shorthand and caps. That's not rudeness, it's speed.

**Where things go — label every block:**
- Starts with `select` / `create` / `alter` / `delete` → **Supabase SQL editor**
- English instructions → **Claude Code**
- Mixing these up is my recurring mistake.

---

## 2. Stack and environment

| | v1 (live) | v2 (building) |
|---|---|---|
| Frontend | One 15k-line index.html + main.js, api.js | React 18 + TypeScript + Vite |
| Styling | 528 inline styles | Tailwind v4 + shadcn/ui |
| State | Globals | TanStack Query v5 + Zustand |
| Router | — | React Router v7 |
| Charts | Chart.js CDN | Recharts |
| Backend | Supabase | Same Supabase, untouched |

- Supabase project ref `fuahuebzjvnpdvkxakgj`
- v1 live at `tecblitzweb-salebsos.vercel.app`, deployed from `master`
- v2 lives in `app/` on branch `v2`, pushed to origin. **Root files are v1 — never touch them**
- GitHub repo is **private** (was public ~7 weeks; all passwords rotated)
- No staging. v1 serves 9 people every working day
- Vercel does **not** auto-promote master. Manual promotion required
- v2 has **no Vercel project yet** — that comes before the parallel-run phase

**Three spec files in the repo root. Claude Code must read all three:**
- `SALESOS_V2_SPEC.md` — what to build, phases, data contracts, §0 rules
- `DESIGN_RULES.md` — how it looks and behaves, exact numbers
- `HANDOFF.md` — this file

---

## 3. Why we rebuilt — v1's real failures

Not style complaints. Each one cost something.

1. **Revenue read Rs 0 for months.** The `closed_deals` table was never created. The app caught
   the 404, set `_closedDealsTableMissing = true`, and **stopped trying forever**. Deals went to
   IndexedDB on one laptop. Settings had a "Reset local cache" button that would have destroyed
   them. When we checked, IndexedDB was empty — no deal had ever been recorded successfully.
2. **Duplicate leads.** IDs were `'lead_' + Date.now()`. The same business logged from two devices
   made two rows. Zanbara Villa ×3.
3. **332 calls invisible to management.** Team Performance filtered `role = 'Sales'`, excluding the
   CEO's and Co-CEO's own calls.
4. **The same number, three answers.** Interested Leads showed 189 / 193 / 172 on three pages.
5. **Client code made security decisions.** `if(!owned.length) return true` let the browser decide
   visibility.
6. **Prospects showed 296 under CEO auth vs 631 under anon** — token decode failure meant every
   request fired anonymously.

---

## 4. Schema truth — verified against production, do not re-derive

`rls_step3_policies.sql` was never run on the live database. **The repo SQL does not describe
production.** Everything below was queried against the live database on 8–9 Aug 2026. Treat every
absolute row count as a snapshot and re-probe; the tables grow.

### Timestamps — the most dangerous trap

| Table | Authoritative | Dead |
|---|---|---|
| `prospects` | `created_at` (timestamptz, 677/677) | `createdat` lowercase — **0/677** |
| `calls` | `createdat` lowercase (all rows) | `"createdAt"` — **0** |

**`createdat` is dead on prospects and authoritative on calls.** Same name, opposite answer, no
error either way.

**Four timestamp conventions across four tables:**

- `calls.createdat` — timestamptz, lowercase
- `prospects.created_at` — timestamptz
- `closed_deals.created_at` — timestamptz
- `interested_leads."createdAt"` — **TEXT**, quoted camelCase, ISO-8601 with Z. Parse explicitly,
  never `new Date()`
- `calls.followup` and `closed_deals.date` — text, compared as strings. Only safe because every
  write path uses `yyyy-MM-dd`

Days since last contact = `now() - max(calls.createdat)` for that prospect. **Never**
`prospects.created_at` — that's when the row was added, not when anyone called.

### Columns that exist

- `prospects`: `id, name, type, area, phone, assignedto, pkg, pain, script, favourite, createdby,
  "createdBy", created_at, updated_at` (+ the dead ones)
- `calls`: `id, prospect, rep, outcome, notes, phone, date, time, duration, followup, createdat,
  updated_at`
- `sales_users`: `id, name, username, email, role, owned_reps, auth_user_id`

There is **no** `package`, `value`, `notes`, `email`, `phone2`, `status`, or `source` on prospects.

**`closed_deals` — 9 columns.** Earlier drafts of this file and of SPEC listed 5 and were wrong.

| column | type |
|---|---|
| id | text |
| biz | text |
| value | numeric |
| rep | text |
| date | **text** |
| pkg | text |
| "leadId" | text (quoted camelCase) |
| source | text |
| created_at | timestamptz |

Bucket by `created_at`. `date` is text and display-only. `rep` holds **canonicalRepKey** values,
not display names — matching v1's live Won path. A deal row without `biz` and `pkg` cannot tell
Revenue what was sold; without `"leadId"` revenue cannot be traced to the lead it closed from.

**`interested_leads` — 20 columns.** All text except `advance_cleared` (boolean) and `updated_at`
(timestamptz). There is **no `lead` column** and **no `value` column** — the business name is
`biz`, and the package (with its value embedded in the string) is `pkg`.

`id, biz, rep, callDate, callNotes, phone, pkg, bizType, status, mockupNotes, mockupUrl,
mockupSentBy, mockupSentAt, callbackNotes, callbackOutcome, callbackAt, createdAt, sourceCallId,
advance_cleared, updated_at`

**A `backup_20260724` schema exists** alongside `public` in the same database — calls, prospects,
interested_leads. Not closed_deals. PostgREST only reads `public`. **This is not an off-database
backup** and must not be treated as one.

### Free-text hazards

- `prospects.pkg` = `"Landing Page - Rs. 65,000"` — value embedded in the string, parse it
- `prospects.phone` may hold two numbers split by `/`
- `calls.prospect` joins `prospects.name` by text. **No foreign key.** Duplicate names exist
- `sales_users.role` stores `Sales`, not `rep`
- `createdby` (310/677) and `"createdBy"` (364/677) — neither complete, coalesce both
- PostgREST caps a response at **500 rows**. Calls is over 1100. Must paginate
- `canonical_rep()` on prod = `lower(regexp_replace(x,'[0-9]+$',''))`. It does **not** trim.
  The client mirrors it byte-for-byte including that flaw

### Data contracts — queried, not inferred

**Pipeline stages.** Stored value → board column:
`new` → New · `pending` → Mockup sent · `called` → Callback · `won` → Won · `lost` → Lost

**`calls.outcome` — five values, verified 8 Aug 2026 at 1145 rows:**
Follow-up needed 347 · Not interested 301 · Interested 205 · No answer 197 · WhatsApp sent 95

Connect % definition: **connected** = Follow-up needed, Not interested, Interested — someone who
answered and said no was still reached. **Not connected** = No answer, WhatsApp sent. A sixth value
must be counted and surfaced, never folded into either side or into the denominator.

**`calls` row count is 1145, not 1074.** Any absolute count is a snapshot. Re-probe.

**205 Interested calls vs 196 leads.** Nine interested calls never created a lead. Surfaced as a
standing banner on Performance.

**Zero leads have ever had status `won`.** v1's Won path was never used. There is no historical
revenue anywhere in the database.

### Rep identity — verified 7 Aug 2026

```
Himanthi2525  306   ┐ same person, 503 calls
Himanthi      197   ┘
Avishka       161   ┐ 258
avishka        97   ┘
Bisara         34   ┐ 39
bisara          5   ┘
```

Always `canonicalRepKey()` before any comparison, group, filter, or count. Display with
`displayRepName()`. **Never `startsWith`/`includes` for identity** — `"san"` matches `Sandaruwan`.

---

## 5. SPEC §0 rules — the hard ones

1. No schema changes
2. No service worker in v2 yet
3. Auth via supabase-js only, never hand-parse localStorage
4. All reads RLS-scoped as the authed user
5. **Never swallow a failed write.** No `catch{}` skip-flags. Red toast with status code, retryable
6. Free-text assignee — normalize with `canonicalRepKey()`
7. `calls.prospect` joins by text, handle N:N
8. `sales_users.role` is `Sales`
9. **IDs are `crypto.randomUUID()`, never `Date.now()`**
10. Client normalization mirrors the DB byte-for-byte, including its flaws
11. `git commit -- <pathspec>` re-reads the working tree, silently discarding staged `--cached`
    deletions. Verify git's file count matches what you staged
12. Never `lsof -ti:PORT | xargs kill -9` — it matches closed client sockets including the Claude
    app. Use `-sTCP:LISTEN`
13. Rep identity: canonical equality only, never prefix matching
14. Deleting a prospect orphans its calls. Never hard-delete a prospect that has calls — archive,
    and warn with the call count

---

## 6. Design identity

**Signature: the temperature bar.** 3px colored left edge on every prospect card, days since last
contact — cyan (never called) → green (0–2d) → amber (3–7d) → orange (8–21d) → red (22d+). Sort
"Coldest first" and a rep opens to a wall of red. The only place those five colors appear together.

**Palette:** warm graphite surfaces (`#0C0A09` → `#4A423B`) so brand cyan `#00E5FF` is the only
cool saturated thing on screen. Light theme brand `#07758F` (clears 4.5:1 on all four light
surfaces). `--color-on-brand` flips per theme.

**Type:** Archivo for page titles, headings, stat numbers, wordmark. Inter for everything else.
`Noto Sans Sinhala` second in both stacks — live data contains Sinhala. Weights 500/600 only.

**Killed from v1:** gradient buttons, weight-700 headings, ALL-CAPS labels, saturated solid badges,
2.5-stroke icons.

**Potential vs real:** closed revenue solid brand; pipeline value brand at 40% opacity with a
dashed border. Unclosed reads *weaker* than closed. v1 showed Rs 21M pipeline more prominently
than Rs 0 closed, and that inversion is part of how we lost track of revenue.

**Density:** row 40px comfortable / 32px compact. Card padding 14px. Sidebar 232px. Slide-over
480px. Prospect card fixed 88px. Radii 6/10/14/20.

---

## 7. Operational rules — learned by breaking things

- **Never `git add .`** — the root has unrelated v1 changes
- **Hard-reload (Cmd+Shift+R) after every dev server restart.** A tab open across a restart runs the
  pre-restart bundle from memory. This cost a full round of false debugging on a fix that was
  already correct
- **Tailwind v4 fails silently.** A token in DESIGN_RULES but absent from `@theme` falls back to
  Tailwind's default with no error. The entire type scale was missing for a whole phase and the
  build passed clean
- **Dev server must be double-forked**, not just `nohup … & disown`. The tool's shell persists
  across calls, so `disown` alone leaves the process parented to it and it gets reaped. Correct
  form is documented in SPEC §9. Verify **PPID is 1**
  - Check alive: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/`
- **Never paste a password into any chat.** I sign in and verify in the browser myself
- Claude Code has no credentials, so it cannot verify anything against real data. **I run every
  browser test.** Don't let it push me to re-verify what already passed

---

## 8. Model policy

Set in Claude Code's bottom-right corner.

| Phase | Model | Why |
|---|---|---|
| 0–2 scaffold, auth, shell | Sonnet | Boilerplate |
| **3 design system** | **Opus** | Taste is the deliverable; all later phases inherit it |
| 4 prospects | Opus | First real data, count correctness |
| **5 calls, writes** | **Opus** | Touches production data |
| 6 follow-ups | Sonnet | Assembling existing parts |
| **7 today** | Sonnet | — |
| 8 pipeline | Sonnet | — |
| **9 revenue, performance** | **Opus** | Numbers must reconcile |
| 10–12 team, settings, polish | Sonnet | — |

Escalate to Opus whenever Sonnet fails twice on the same thing.

**The `/model` switch has failed twice**, on Phases 8 and 9, both of which this policy assigns to
Opus. The dropdown showed Opus 5; Claude Code reported running as Sonnet.

Rule: **Claude Code must state its model as the first line of every phase report. Trust that, not
the dropdown.** Set the model in a **new session**, not mid-conversation. Confirm the model in
Claude Code's own report before any phase that touches money or writes.

---

## 9. What's done

**Phase 0** — Vite + React 18 + TS in `app/`. Root v1 files checksum-verified after every phase.

**Phase 1** — Auth. **Verified in browser:** login works, role reads CEO, Authorization header
carries a real JWT (`eyJhbGciOiJFUzI1NiIs…`), not the anon key. v1's fatal bug is structurally gone.

**Phase 2** — App shell. Sidebar 232px, collapsible to 56px (Cmd+B, persisted). Groups Work /
Pipeline / Insights / Admin. Mobile bottom tab bar. Role-gated nav and routes share one roles array,
so they can't drift. Settings visible to all roles; Team is CEO-only.

**Phase 3** — Design system + `/kitchen-sink` (dev-only, outside auth). Both themes
contrast-verified. Found and fixed: the entire type scale was missing from `@theme`.

**Phase 4 — Prospects. TESTED, WORKING.** ALL reads **677**, matching `select count(*)` at the time.
Activity chips real, temperature bars correct, filters, slide-over with call timeline, scripts in
their own collapsed field, live duplicate detection on add.

**Phase 5 — Writes. TESTED, WORKING.** Calls insert with UUID ids and correct Asia/Colombo
date/time. Favourites toggle. Optimistic + rollback. No write fails silently. Fixed along the way:
a timezone bug filing every 18:30–24:00 UTC call under the previous day, and a free-text business
field that orphaned calls.

**Phase 6 — Follow-ups. TESTED, WORKING.** Three buckets, snooze presets, swipe gestures, rep
chips, Unlinked toggle (default hidden). Row click works across the whole row.

**Phase 7 — Today. Built, not browser-tested.** Action queue (overdue → today's → never-called,
capped at 10, orphans excluded), four stat cards with same-weekday deltas, self-only pace bar
(30-day calls ÷ 30 calendar days), activity feed, Coverage block with inline reassign for
CEO/Co-CEO.

**Phase 8 — Pipeline. Built, write path verified against the database.** Kanban New/Mockup
sent/Callback/Won/Lost, Won and Lost on every card. Won writes all nine `closed_deals` columns,
deal row written *before* the lead moves, dedupe on `leadId`, `advance_cleared` set true to match
v1. Verified end-to-end: one real deal written and confirmed in the database, then deleted. Shared
`VirtualList` extracted so both Prospects and Pipeline use one implementation.

**Phase 9 — Revenue and Performance. Built, not browser-tested.** Revenue renders three distinct
states (table empty / none in range / read failed) and never shows Rs 0 as a measured figure.
Performance lists all of `sales_users` unfiltered by role, zero-call reps greyed and kept,
off-roster people badged. Pace-to-target deliberately **not built** — no target exists and none
should be invented. Funnel percentages deliberately **removed**; renamed "Activity counts" because
the four steps measure different populations.

**Commit state, 9 Aug 2026.** Everything through Phase 9 is now committed on `v2`: Phases 7 and 8
in `7e420b6`, Phase 9 in `dfa2459`. An earlier draft of this file claimed Phases 7 and 8 were
already on `origin/v2` — they were not; all three of 7, 8 and 9 sat uncommitted in the working tree
until 9 Aug. **Never state a phase is committed without reading `git log`.** Both are pushed to
`origin/v2`.

---

## 10. Known open items

**No off-database backup exists.** `pg_dump` needs Homebrew (absent) and `supabase db dump` needs
Docker (absent). The `backup_20260724` schema is in the *same database* and does not count.
Table Editor → Export CSV on all six tables, stored outside Supabase. **Do this.**

**106 orphaned calls (~10% of history).** Prospects were deleted while their calls remained.
`NEW TEC KITCHEN EQUIPMENTS` has 9 calls across six weeks and is invisible. Four were fuzzy typos
and are fixed. The rest need prospect rows recreating. **Parked until v2 ships.** Rule 14 prevents
recurrence.

**Mark done is lossy.** It clears `calls.followup` to null, matching v1, so "how many follow-ups
did Himanthi complete last month" is unanswerable and no follow-ups-due delta is possible. Fixing
it needs a `followup_done` column and a decision from me.

**Pipeline has no nav tab.** Reachable only at `/pipeline`.

**Phones.** `lib/phone.ts` handles multi-number and the `94` prefix on Today and Pipeline.
`ProspectRow`, `ProspectDetail` and `ProspectCard` still carry the original broken `wa.me`
construction. Separate task, isolated diff.

**Historical deals must be entered by hand** or Revenue launches empty. Nothing in the database
records a closed deal.

**Data to clean before launch.** "The Villa Green Hotel" is duplicated in leads. Prospects count is
681, up from 677 — the extra rows are tests and should be deleted.

**`supabase/set_rep_passwords.sql`** is still in git history across six branches. Passwords are
rotated so it's reconnaissance value only. `git rm` it from the working tree; skip `filter-repo`.

**Never verified:** whether ex-staff (Ramesh, Dulaj, Dilitha) still have GitHub collaborator access.

**Parked for Phase 12:** native `<datalist>` degrades badly with 677 names on mid-range Android.
Desktop drag-and-drop on the pipeline board is still missing (logged from Phase 8). react-router
7.18.2 advisory is RSC-only and doesn't apply to an SPA — accepted.

---

## 11. What happens next

- **Phase 10** — Team + Settings. Destructive actions need typed confirmation
- **Phase 11** — Command palette, shortcuts, bulk actions, CSV, port `/api/claude`
- **Phase 12** — Polish, a11y, code-splitting, Lighthouse ≥90, plus the desktop drag-and-drop gap
- **Phase 13** — Create the v2 Vercel project. Both apps live, one week parallel run
- **Phase 14** — Cutover. v1 stays reachable 30 days

Phases 7, 8 and 9 are built but only Phase 8's write path has been verified against real data.
Browser-test 7 and 9 before starting 10.

---

## 12. Verification checklist — every phase

- Hard-reload (Cmd+Shift+R), Incognito, fresh login
- Test as three roles: Bisara (CEO), Avishka (Co-CEO), Chamindu (Sales)
- Confirm counts against the Supabase SQL editor — **the UI is not the source of truth**
- Network tab: every request carries the user JWT, not the anon key
- Test at 390px and 1440px
- RLS denial on read = `[]`, never 401. 401 = auth. 403/42501 = permission. Surface all three
  differently. **Never show an empty state when the cause was an error**
- **Tap every action. Do not just look at it.** Three phases shipped with broken WhatsApp links
  because they were reviewed by eye
- A clean `tsc -b` and `vite build` prove the code compiles and nothing else. Tailwind v4 fails
  silently; a 400 on an unknown column renders as an error state that looks like an empty state
- Confirm the model in Claude Code's own report before any phase that touches money or writes
- Check every open question from the previous report has an answer in your paste. Four answers were
  dropped mid-review and each cost a round trip
