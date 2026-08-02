# TecBlitzWeb Sales OS v2 — Build Spec

**For:** Claude Code
**Rule:** Do not modify the Supabase schema. Read/write existing tables only.
**Branch:** `v2`. New app lives in `app/`. The root files are the live app — do not touch them.

---

## 0. Non-negotiables

1. **No schema changes.** No `ALTER TABLE`, no migrations. Tables are fixed:
   `prospects`, `calls`, `interested_leads`, `closed_deals`, `jobs`, `sales_users`.
2. **No service worker** in v1 of v2. Add later, only once the app is stable.
3. **Auth via `supabase-js` only.** Use `supabase.auth.getSession()` / `onAuthStateChange`.
   Never hand-parse localStorage. Never send the anon key as `Authorization` for user data.
4. **All reads run through RLS as the authenticated user.** No service-role key in the client.
5. **Never swallow a failed write.** No `catch {}` that sets a "skip forever" flag. A failed
   mutation shows a red toast with the status code and retries next attempt. The
   `_closedDealsTableMissing` pattern in v1 destroyed the entire revenue record. Never repeat it.
6. **Free-text assignee is a fact of life.** `prospects.assignedto` and `calls.rep` hold values
   like `Himanthi2525`, `rashitha`, `Avishka`. Normalize with one shared `canonicalRepKey()` that
   mirrors the DB's `public.canonical_rep()` exactly: strip trailing digits, lowercase, no trim.
   See rule 10 and the comment in `src/lib/repKey.ts`.
7. **`calls.prospect` joins `prospects.name` by text.** No foreign key. Duplicate names exist.
   Joins must handle N:N and never assume uniqueness.
8. **`sales_users.role` stores `Sales`, not `rep`.** Roles in prod: `CEO`, `Co-CEO`, `Sales`.
9. **Never generate record IDs from `Date.now()`.** v1 did this for leads and produced triplicate
   rows across devices. Use `crypto.randomUUID()`, and dedupe against the server, not local state.
10. **Client normalization must mirror the database function byte-for-byte, including its flaws.**
    Never "improve" a normalization on the client — a client that is more correct than the database
    silently returns fewer rows.

---

## 1. Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Routing | React Router v7 |
| Server state | TanStack Query v5 |
| Client state | Zustand (auth/session/UI only) |
| Styling | Tailwind CSS + CSS variables |
| Components | shadcn/ui (Radix) |
| Charts | Recharts |
| Icons | lucide-react |
| Dates | date-fns |
| Tables | TanStack Table v8 |
| Backend | Existing Supabase project `fuahuebzjvnpdvkxakgj` |

`app/vercel.json`:

```json
{
  "buildCommand": "vite build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

Env vars (Vercel project settings):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY` (server-only, for `/api/claude`)

---

## 2. Project structure

```
app/
  src/
    main.tsx
    App.tsx
    lib/
      supabase.ts
      queryClient.ts
      repKey.ts
      format.ts
    types/
      db.ts
    auth/
      AuthProvider.tsx
      useAuth.ts
      RequireAuth.tsx
      LoginPage.tsx
    api/
      prospects.ts
      calls.ts
      leads.ts
      deals.ts
      jobs.ts
      users.ts
      counts.ts
    components/
      ui/
      layout/
      shared/
    features/
      dashboard/
      prospects/
      calls/
      followups/
      pipeline/
      revenue/
      performance/
      team/
      settings/
```

**Hard rule:** no file over 400 lines. Split into `PageName.tsx` + `usePageName.ts` + `components/`.

---

## 3. Design system

Replace the 2023 purple-gradient look entirely. Target: Linear / Attio density.

`app/src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-bg:            #08090C;
  --color-surface:       #0E1014;
  --color-surface-2:     #14171D;
  --color-surface-3:     #1B1F27;
  --color-border:        #232833;
  --color-border-strong: #333A47;

  --color-text:          #F2F4F8;
  --color-text-muted:    #9BA3B4;
  --color-text-subtle:   #646C7C;

  --color-brand:         #00E5FF;
  --color-brand-hover:   #33EBFF;
  --color-brand-dim:     #00B8D4;
  --color-brand-ghost:   rgba(0, 229, 255, 0.08);

  --color-success:       #22C55E;
  --color-warning:       #F59E0B;
  --color-danger:        #EF4444;
  --color-info:          #3B82F6;

  --radius-sm: 6px;  --radius-md: 10px;  --radius-lg: 14px;  --radius-xl: 20px;
  --shadow-1: 0 1px 2px rgba(0,0,0,.4);
  --shadow-2: 0 4px 16px rgba(0,0,0,.5);
}
```

Tokens live in `@theme`, not a plain `:root` block, so Tailwind v4 generates real utilities
from them — `bg-surface`, `text-brand`, `border-border`, `rounded-md`, `shadow-1`, etc.
Values are unchanged from the palette above; only the CSS mechanism changed (custom
property names gained the `color-`/`radius-` prefixes Tailwind's theme scanner requires —
`--r-sm` became `--radius-sm`, `--bg` became `--color-bg`, and so on).

Also ship a light theme. Toggle in Settings, persisted to localStorage, respects
`prefers-color-scheme` on first load.

**Rules**
- No gradients on surfaces. Brand gradient only on the logo mark and primary CTA.
- Type: Inter via `@fontsource`. Scale 11/12/13/14/16/20/24/32. `tabular-nums` on all numbers.
- Spacing: 4px base. Dense by default — this is a work tool.
- Zero inline `style=`. v1 has 528. Tailwind only.
- Motion 120–180ms `ease-out`. Respect `prefers-reduced-motion`.
- Never hardcode a hex value in a component. Use the token utility.

**Responsive — both devices matter equally**
- ≥1024px: persistent sidebar, multi-column, data tables, keyboard shortcuts.
- <768px: bottom tab bar (5 max), single column, cards not tables, sheets not modals,
  44px tap targets, thumb-reachable primary actions.
- Rep flows are phone-shaped. Manager flows are desktop-shaped. Design each for its device.

---

## 4. Information architecture

```
WORK              PIPELINE            INSIGHTS         ADMIN
  Today             Prospects           Performance      Team
  My Calls          Interested Leads    Revenue          Announcements
  Follow-ups        Jobs                AI Report
  Settings
```

Settings lives in WORK, not ADMIN — every role needs to reach their own profile,
theme, and password, not just management.

- `Sales` → WORK (including Settings) + Prospects, Interested Leads, Jobs. Own data only.
- `Co-CEO` → above + INSIGHTS, scoped to `owned_reps`, + Announcements.
- `CEO` → everything, including Team.

CEO and Co-CEO differ in data scope (`owned_reps` vs. everything), not page access.
Team is the sole exception: org control is CEO-only.

---

## 5. Pages

### 5.1 Today (replaces Dashboard)
Tells the rep what to do next, not just stats.
- **Action queue** (largest): next 10 things — overdue follow-ups, then today's, then uncalled
  assigned prospects. Each row: name, business, why surfaced, one-tap Call / WhatsApp / Log.
- **Numbers strip:** calls logged, interested created, follow-ups due, deals closed, each with
  delta vs. same day last week.
- **Pace:** calls today vs. that rep's own 30-day average. Self-comparison, not a leaderboard.
- **Activity feed:** last 15 calls in visible scope.
- CEO/Co-CEO variant adds rep coverage — who has untouched assigned prospects, worst first.

### 5.2 Prospects
- Server-side search, filter, sort. Virtualized list (673+ rows must not block the thread).
- Filters: assignee, status, last-contacted range, has-follow-up, never-called, source.
- Saved views per user in localStorage.
- Activity chips (Follow-up / WhatsApp / Not Interested / No Answer) from the calls join.
- Bulk select → bulk reassign (CEO/Co-CEO), bulk tag.
- Row click → **slide-over panel**, not navigation. Contact block, call timeline, notes,
  next action, quick-log form.

### 5.3 My Calls
- Grouped by day, newest first, infinite scroll.
- Inline outcome edit. Filter by outcome and date range.
- Log Call = floating action button on mobile, `C` shortcut on desktop.

### 5.4 Follow-ups
- Three buckets: Overdue (red), Today (brand), Upcoming (muted).
- Snooze: +1d / +3d / +1w / pick date.

### 5.5 Interested Leads → Pipeline
- Kanban by stage, drag to move (desktop). Mobile: stage tabs + list, move via row menu.
- Column headers show count + total value.
- Card: name, business, package, value, days-in-stage, owner.
- **Every card has Won / Lost buttons.** A lead must not sit in "Interested" for 90 days silently.
- Aging indicator — card border warms as days-in-stage grows.

### 5.6 Revenue
- Monthly/quarterly bar + cumulative line. Package mix. Per-rep contribution.
- Target vs. actual with pace projection. Export CSV.

### 5.7 Performance
- Per-rep table: calls, connect rate, interested rate, close rate, revenue.
- **Include ALL roles.** Never filter to `role = 'Sales'` — v1 did, hiding 332 calls from
  Bisara and Avishka.
- Funnel: prospects → called → interested → closed, with drop-off % per step.

### 5.8 Team (CEO only)
- Rep list with role, `owned_reps`, last active, caseload.
- Add/edit/deactivate. Reassignment flow on deactivate — must not orphan rows.

### 5.9 Settings
- Profile, password, theme, density, notification prefs.

---

## 6. New capabilities

| Feature | Why it drives sales |
|---|---|
| Command palette (⌘K) | Jump to any prospect, log a call, switch page |
| Global search | One box across prospects, calls, leads, deals |
| Keyboard shortcuts | `C` log · `P` prospects · `/` search · `J/K` move · `Enter` open |
| Slide-over panels | Inspect without losing list position or filters |
| Optimistic mutations | Instant UI, rollback on error — 10x faster on 3G |
| Saved views | Reps rebuild the same filter 20x/day today |
| Duplicate detection | Warn on create when name/phone fuzzy-matches existing |
| Activity timeline | Every call, status change, note in one view |
| Bulk actions | Reassign 40 prospects in one action |
| CSV import/export | Prospects in, reports out |
| Skeletons + empty states | Every empty state gets a primary action |
| Toast + undo | 5s undo on destructive actions |
| Offline-tolerant reads | Query persist to IndexedDB, queue writes when offline |

---

## 7. Data layer contract

One hook file per table. Every hook is RLS-scoped. **Client-side filtering is for UX only;
the database is the authority.** v1's `if(!owned.length) return true` in main.js let client
logic make a security decision — never repeat that.

```ts
// src/api/prospects.ts
export function useProspects(filters: ProspectFilters) {
  return useQuery({
    queryKey: ['prospects', filters],
    queryFn: () => supabase.from('prospects').select('*').order('createdat', { ascending: false }),
    staleTime: 30_000,
  })
}
```

**One canonical count per entity.** All counts come from a single `src/api/counts.ts` hook.
v1 showed Interested Leads as 189 / 193 / 172 on three different pages. Every page must agree.

**Column naming is inconsistent — verify each before use:**
- `prospects`: `assignedto`, `createdat` / `"createdAt"`, `createdby`
- `calls`: `rep`, `prospect`, `createdat`
- Three near-duplicate timestamp conventions exist. Inspect, don't assume.

**Error handling — surface all three differently:**
- RLS denial on read → empty array `[]`, never 401
- RLS denial on write → Postgres `42501` / HTTP 403
- HTTP 401 → auth failure (expired JWT) → refresh, retry once, then sign out

Never show "no data" when the cause was auth.

---

## 8. Build order

Each phase ends deployable and verifiable. Do not start N+1 until N is verified in Incognito.

| Phase | Deliverable | Done when |
|---|---|---|
| 0 | Repo + Vite + Tailwind + shadcn + Vercel project | Empty shell builds |
| 1 | Supabase client, AuthProvider, Login, RequireAuth | All 9 accounts log in; user token in every request |
| 2 | AppShell — sidebar, mobile nav, theme, palette skeleton | Navigation works both breakpoints |
| 3 | Design system — all shared components at `/kitchen-sink` | Every component renders in both themes |
| 4 | Prospects (list, filters, slide-over, activity chips) | CEO count = 673; chips show real numbers |
| 5 | Calls — My Calls, log flow, timeline | Rep logs a call; rep reassigning `rep` returns 403 |
| 6 | Follow-ups | Buckets correct against DB |
| 7 | Today page | Action queue ordering matches spec |
| 8 | Pipeline kanban + Won/Lost | Drag persists; refresh keeps state |
| 9 | Revenue + Performance | Reconcile against v1 within 1%; all roles counted |
| 10 | Team + Settings | Role gating verified for all 3 roles |
| 11 | Palette, shortcuts, bulk actions, CSV, `/api/claude` port | — |
| 12 | Polish, a11y, Lighthouse ≥90, error boundaries | — |
| 13 | Parallel run — both apps live, one week | Zero data discrepancies |
| 14 | Cutover — primary domain to v2, keep v1 reachable 30 days | — |

---

## 9. Verification (every phase)

- Test in **Incognito** on the v2 Vercel URL with a fresh login.
- Test as three roles: Bisara (CEO), Avishka (Co-CEO), Chamindu (Sales).
- Confirm counts against the Supabase SQL editor — the UI is not the source of truth.
- Network tab: every data request carries the user JWT, not the anon key.
- Test at 390px and 1440px.
- Throttle to Slow 3G once per phase.

---

## 10. Out of scope

- Any schema change, RLS change, or data migration.
- Touching root-level v1 files, its Vercel project, or its domain.
- Deleting any user or row.
- Rewriting `/api/claude` — port as-is in phase 11.
