# TecBlitzWeb Sales OS v2 — Design Rules

Companion to `SALESOS_V2_SPEC.md`. That file says *what to build*. This one says *what it looks like
and how it behaves*. Read both before any UI work. Where they disagree, this file wins on visuals.

---

## 0. Who this is for

Reps in Sri Lanka cold-calling local businesses — hotels, salons, garages, restaurants — mostly from
phones, often on mobile data, often mid-conversation with the phone at their ear. Managers review on
desktop. Notes are typed in Sinhala, romanized Sinhala, and English, frequently in one sentence.

Design consequences:
- **One-handed operation matters.** Primary actions live in the bottom third on mobile.
- **Speed of logging beats completeness of forms.** A call log that takes 20 seconds doesn't get filled in.
- **Density over decoration.** A rep scans 60 prospects looking for the next number to dial.

---

## 1. The signature: temperature

Every prospect and lead carries a **3px left edge bar** encoding days since last contact. It's the one
memorable element in the interface, and it's honest — this is a cold-calling business, so the card
literally shows how cold the lead has gone.

| Days since last call | Bar color | Meaning |
|---|---|---|
| Never called | `--color-brand` | Fresh, untouched |
| 0–2 | `--color-success` | Warm |
| 3–7 | `--color-warning` | Cooling |
| 8–21 | `--color-cold` | Cold |
| 22+ | `--color-danger` | Dead unless rescued |

The bar is the **only** place these five colors appear together. Everywhere else, color is used
sparingly. Never add a second decorative accent — this is where the boldness is spent.

Sort options include "Coldest first." A rep who wants work opens Prospects and sees red at the top.

---

## 2. Typography

```css
--font-sans: "Inter", "Noto Sans Sinhala", system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, monospace;
```

**Sinhala is mandatory, not optional.** Live notes and business names contain Sinhala script. Inter
has no Sinhala glyphs. Load `@fontsource/noto-sans-sinhala` and keep it second in the stack so Latin
still renders as Inter. Test with: `සොරොම්බ ඇගම් සජී, Horana Ana Kade`

**Scale** — 8 sizes, no others:

| Token | px / line-height | Use |
|---|---|---|
| `text-2xs` | 11 / 16 | Table column headers, metadata, timestamps |
| `text-xs` | 12 / 18 | Badges, chips, helper text |
| `text-sm` | 13 / 20 | **Table rows, card body — the workhorse** |
| `text-base` | 14 / 22 | Form inputs, buttons, notes |
| `text-lg` | 16 / 24 | Card titles, section headers |
| `text-xl` | 20 / 28 | Page titles |
| `text-2xl` | 24 / 32 | Stat card numbers |
| `text-3xl` | 32 / 40 | Hero stat only (one per page maximum) |

**Weights:** 400 body, 500 emphasis, 600 headings. Never 700 — v1's chunky headings are why it reads
as 2023. Never 300.

**Numbers:** `font-variant-numeric: tabular-nums` on every figure in a table, stat card, or list.
Non-negotiable — columns of counts must align.

**Phone numbers:** `--font-mono`, `letter-spacing: 0.02em`. They're data to be read aloud, not prose.

---

## 3. Density — exact numbers

| Element | Value |
|---|---|
| Table row height | 40px (comfortable) / 32px (compact) |
| Card padding | 14px |
| Card gap in a list | 8px |
| Section gap | 24px |
| Page padding | 24px desktop / 16px mobile |
| Input height | 36px |
| Button height | 32px small, 36px default, 44px mobile primary |
| Sidebar width | 232px |
| Slide-over width | 480px desktop, full-screen mobile |
| Border radius | `--radius-md` (10px) on cards, `--radius-sm` (6px) on chips, inputs, buttons |

Density toggle in Settings switches row height and card padding only. Nothing else moves.

---

## 4. Component rules

**Borders over shadows.** Cards use `1px solid var(--color-border)` on `--color-surface`. Shadows
only on floating layers: slide-overs, dropdowns, toasts, command palette.

**Chips / status badges**
- Height 20px, padding 0 8px, `text-xs`, weight 500, `--radius-sm`
- Background: the semantic color at 12% alpha. Text: the semantic color at full strength.
- Never a solid filled badge — v1's saturated pills fight the content for attention.

| Outcome | Color |
|---|---|
| Interested | `--color-success` |
| Follow-up needed | `--color-warning` |
| WhatsApp sent | `--color-info` |
| Not interested | `--color-danger` |
| No answer | `--color-text-subtle` |
| New / no calls | `--color-brand` |

**Buttons**
- Primary: `--color-brand` background, `#00181C` text (dark text on cyan — white fails contrast)
- Secondary: transparent, `1px solid var(--color-border-strong)`, `--color-text`
- Ghost: transparent, no border, `--color-text-muted`, hover → `--color-surface-2`
- Destructive: transparent, `--color-danger` text, border `--color-danger` at 30%
- **No gradient buttons.** v1's gradient CTAs are the single most dated element in it.

**Hover:** background steps one surface level up (`surface` → `surface-2`). 120ms. Never move,
scale, or shadow on hover.

**Focus:** `2px solid var(--color-brand)`, `outline-offset: 2px`. Visible on every interactive
element. Never `outline: none` without a replacement.

**Icons:** lucide, 16px inline, 20px standalone, `stroke-width: 1.75`. Never 2.5 — v1's heavy icons
read as clip art.

---

## 5. Light theme

Ship both. Same token names, different values, swapped via `.dark` class on `<html>`.

```css
/* light */
--color-bg:            #FAFAFB;
--color-surface:       #FFFFFF;
--color-surface-2:     #F4F5F7;
--color-surface-3:     #EBEDF0;
--color-border:        #E2E5EA;
--color-border-strong: #CBD1DA;
--color-text:          #0E1014;
--color-text-muted:    #545C6B;
--color-text-subtle:   #8992A3;
--color-brand:         #0891B2;   /* #00E5FF is unreadable on white — darken for light mode */
--color-brand-hover:   #0E7490;
--color-brand-dim:     #06798F;
--color-brand-ghost:   rgba(8, 145, 178, 0.08);
```

Semantic colors (success/warning/danger/info) stay the same in both themes.

Default: follow `prefers-color-scheme` on first load, then persist the user's choice.

---

## 6. The prospect card

The most-used object in the app. Two forms.

### 6a. List card (compact — the default)

```
┌─┬──────────────────────────────────────────────────────────────┐
│ │ ☆  SpringView Holiday Home            Landing Page · 65,000  │
│ │    Hotel · Badulla · Himanthi              ⌄ 3 calls · 12d   │
│ │                                                              │
│ │    ● Follow-up needed    077 352 2686   [call] [wa] [log]    │
└─┴──────────────────────────────────────────────────────────────┘
 ↑ temperature bar
```

Fixed height **88px**. Everything above must fit — no card grows to fit its content.

- **Line 1:** favourite star (16px, filled `--color-warning` when set) · business name
  (`text-lg`, weight 500, truncate) · package + value right-aligned (`text-sm`, tabular)
- **Line 2:** type · area · assigned rep, all `text-xs` `--color-text-muted`, separated by `·`.
  Right side: call count and days-since-last, with the expand chevron.
- **Line 3:** latest outcome chip · primary phone (mono) · three icon buttons

**Icon buttons, 32px each:** Call (`tel:`), WhatsApp (`wa.me`), Log call (opens the sheet).
On mobile these are 44px and sit at the card's right edge, thumb-reachable.

**Row click** opens the slide-over. **Chevron** expands inline to show the second phone number and a
2-line note preview. Never both.

### 6b. Detail slide-over

480px from the right (full-screen on mobile). Sticky header, scrolling body.

```
Header    ☆  SpringView Holiday Home            [Edit] [×]
          Hotel · Guesthouse · Badulla
          Landing Page — Rs. 65,000 · Himanthi

Actions   [ Log call ]  [ WhatsApp ]  [ Add follow-up ]     ← 36px, full width row

Contact   077 352 2686   primary    [call] [wa] [copy]
          077 273 3319   alt        [call] [wa] [copy]
          springview@gmail.com      [copy]

Timeline  ● 01 Aug  14:18  Avishka   Interested
            proposal eka whatsapp dekatma yauwa
          ● 28 Jul  11:02  Himanthi  No answer
            no ans
          ● 24 Jul  09:40  Himanthi  Follow-up needed
            wed krn kenek kth kre ownert kiyannm kiw

Script    ▸ Cold call script                          ← collapsed, opens in own panel
Meta      Added 1 Aug 2026 by Bisara · Source: Google Maps
```

**The script is collapsed by default and opens in a separate full-height panel.** In v1 these scripts
are dumped into the notes field, which is why one prospect card is 40 screens tall. Scripts get their
own field, their own view, `--font-mono`, and a "Copy for call" button.

**Timeline** is the heart of the panel. Each entry: dot in the outcome color, date, time, rep,
outcome chip, then the note in `text-sm`. Sinhala must render correctly here — this is where it lives.

### 6c. Add / edit prospect

A **sheet**, not a modal — bottom sheet on mobile, right slide-over on desktop. Same 480px.

Fields in this order, because it matches how a rep actually gets the information:

1. **Business name** — required, autofocus. Fuzzy-checks against existing prospects **as you type**.
   Match found → inline warning card: *"Rockhill Holiday Bungalow already exists, assigned to
   Himanthi, last called 12 days ago."* with **[Open it]** and **[Add anyway]**. This is how you stop
   the Zanbara Villa triplication from happening again.
2. **Phone** — required, mono input, auto-formats to `0XX XXX XXXX`. Also duplicate-checked.
3. **Phone 2** — optional, appears once phone 1 is filled.
4. **Type** — searchable select: Hotel/Guesthouse, Salon, Restaurant, Garage, Retail, Construction,
   Education, Medical, Other. Free-text allowed.
5. **Area** — combobox pre-filled with areas already in the data.
6. **Package** — Landing Page / Business Website / eCommerce. Selecting one auto-fills the standard
   value; editable.
7. **Assign to** — CEO/Co-CEO see all reps; a Sales rep sees only themselves, disabled.
8. **Notes** — 3-row textarea, `text-base`.
9. **Script** — separate collapsed field, mono, expands to full height.

Save button is sticky at the bottom of the sheet, full width, 44px on mobile. Label: **"Add prospect."**
On success the toast says **"Prospect added"** with an **Undo** action for 5 seconds.

Never a full-page form. Never a centered modal that traps a phone keyboard.

---

## 7. Per-section requirements

### Today
- **Action queue** is the page's hero — not a stat strip. Ten rows maximum, each with a one-tap action.
  Each row states *why* it surfaced: "Overdue 6 days," "Follow-up due today," "Never called."
- Stat strip sits **below** the queue, four numbers, `text-2xl`, each with a `text-2xs` delta vs. the
  same weekday last week (green up, red down, grey flat).
- Pace bar: today's calls vs. that rep's own 30-day average. Self-comparison only. Never a leaderboard
  — public ranking of a 7-person team where 5 have zero calls is demoralizing, not motivating.
- Empty queue is a real state, not blank: **"Nothing due. Want to work the coldest prospects?"** with
  a button that opens Prospects sorted coldest-first.
- CEO/Co-CEO extra block: **Coverage** — reps with untouched assigned prospects, worst first, with a
  Reassign action inline.

### Prospects
- Filter bar is a **single row of removable chips**, not a dropdown panel. Active filters are always
  visible so nobody wonders why the count changed.
- Filters: assignee · status · last-contacted · package · area · type · never-called · has-follow-up
- Sort: **Coldest first** (default) · Newest · Name · Value · Most called
- Saved views as pinned chips left of the filter bar. Star a view to pin it.
- Count strip along the top, each figure a clickable filter — matches v1's behaviour, which was right.
- Virtualized list. 673 rows must scroll at 60fps on a mid-range Android phone.
- Bulk mode: long-press on mobile, checkbox on desktop. Action bar slides up from the bottom with
  Reassign, Tag, Export, Delete.

### My Calls
- Grouped by day with a **sticky date header**. Each header shows that day's count and outcome mix as
  a 4px stacked bar.
- **Log Call** is a FAB on mobile (bottom-right, 56px, above the tab bar) and a `C` shortcut on desktop.
- The log sheet defaults: business = last-viewed prospect, date/time = now, rep = current user.
  A rep should log a call in **under 15 seconds**. Time it.
- Outcome is a **6-button grid**, not a dropdown. Two taps beats a select on mobile.
- Selecting "Follow-up needed" reveals a date field pre-filled to tomorrow, with +1d / +3d / +1w chips.
- Selecting "Interested" shows an inline confirmation: *"This will create a pipeline lead."*
  Never create records silently.

### Follow-ups
- Three collapsible sections: Overdue / Today / Upcoming. Overdue is open by default and shows the
  count in the header.
- Each row: temperature bar · business · rep · days overdue · outcome chip · **[Update]**
- Swipe right on mobile = snooze. Swipe left = mark done.
- Rep filter chips across the top (v1 has this and it works — keep it).

### Pipeline
- Kanban on desktop: New → Mockup sent → Callback → **Won** / **Lost**
- Column header: stage name, count, and total value.
- Card: temperature bar · business · rep · package · value · days-in-stage · phone icon buttons
- **Won and Lost are always visible on every card**, not buried in a menu. v1 had no way to close a
  deal, and it recorded Rs 0 for its entire life. This is the fix.
- Won → sheet asking final value and date → writes to `closed_deals`.
- Mobile: horizontal stage tabs, vertical list, stage change via the row menu. Do not attempt
  drag-and-drop on touch.

### Revenue
- Hero: closed revenue this month, `text-3xl`, with pace-to-target below.
- Then: monthly bars + cumulative line. Package mix. Per-rep contribution.
- Pipeline value shown **separately and labelled clearly as unclosed** — never summed with closed
  revenue. Conflating the two is how a business thinks it made Rs 21M when it made Rs 0.
- Export CSV.

### Performance
- Table: rep · calls · connect % · interested % · close % · revenue · trend sparkline
- **Every role appears, including CEO and Co-CEO.** v1 filtered to `role = 'Sales'` and hid 332 calls.
- Funnel below: prospects → called → interested → closed, with drop-off % between each step.
- Date range chips: Today · Week · Month · All · Custom.
- Reps with zero calls still appear, greyed, so absence is visible rather than silent.

### Team
- Card per rep: avatar, name, role, caseload, last active, calls this week.
- Deactivate opens a **required** reassignment step. Cannot complete while rows are still owned.
- Ownership editing for Co-CEO via multi-select.

### Settings
- Sections: Profile · Appearance · Notifications · Data
- Appearance: theme (System/Light/Dark), density (Comfortable/Compact)
- **"Reset local cache" gets a typed confirmation.** In v1 it silently destroyed the only copy of
  closed-deal data. Any destructive action requires typing the word `RESET`.

---

## 8. Empty, loading, error

**Loading:** skeletons matching the real layout's shape. Never a spinner on a full page. Never a
layout that jumps when data arrives — reserve the space.

**Empty:** one line of plain explanation plus one primary action. Never an illustration, never
"Nothing here yet."
- Prospects, filtered → *"No prospects match these filters."* **[Clear filters]**
- Calls, today → *"No calls logged today."* **[Log a call]**
- Pipeline stage → *"Nothing in Mockup sent."*

**Error:** state what failed and what to do. Show the status code. Offer retry.
- *"Couldn't load prospects (503). Check your connection."* **[Retry]**
- *"Save failed (403). You may not have permission to change this rep."* **[Retry] [Copy details]**

**Never show an empty state when the real cause was an error or an auth failure.** That is the exact
bug that hid v1's revenue for months.

---

## 9. Motion

- Duration 120ms micro, 180ms panels. Easing `cubic-bezier(0.2, 0, 0, 1)`.
- Slide-overs slide. Sheets slide up. Toasts fade up 8px.
- **No entrance animation on lists.** Staggered card fade-ins are the clearest AI-design tell and
  they make a 673-row list feel slow.
- `@media (prefers-reduced-motion: reduce)` → all durations to 0.01ms.

---

## 10. Quality floor

- Every interactive element reachable by keyboard, with a visible focus ring.
- Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI borders. Check cyan on dark.
- Touch targets ≥ 44px on mobile.
- Works at 360px width.
- No layout shift on data load.
- Lighthouse ≥ 90 on Performance and Accessibility before Phase 12 closes.

---

## 11. Copy rules

- Sentence case everywhere. Not Title Case, not ALL CAPS. v1's `TEAM OVERDUE FOLLOW-UPS` shouts.
- Buttons name the outcome: **Add prospect**, **Log call**, **Send mockup**, **Mark won**.
  Never Submit, never OK.
- The button's verb matches the toast: "Add prospect" → "Prospect added."
- Errors don't apologize and are never vague. State what happened and what to do next.
- Currency: `Rs 65,000`. No decimals, thousands separators, non-breaking space after `Rs`.
- Dates: `01 Aug` in lists, `1 Aug 2026` in detail, relative ("2 days ago") only under 7 days.
- Never say "rep" in the interface. Say the person's name.
