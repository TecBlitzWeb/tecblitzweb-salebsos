import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, Search, UserCog, Users, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../auth/useAuth'
import { splitPhones } from '../../api/prospects'
import {
  usePaletteLeads,
  usePalettePeople,
  usePaletteProspects,
  type PaletteLead,
  type PalettePerson,
  type PaletteProspect,
} from '../../api/palette'
import { phoneSearchKey } from '../../lib/phone'
import { SupabaseError } from '../../lib/queryClient'
import { NAV_ITEMS, canAccessPath } from '../layout/navConfig'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

/** Per group, not overall — ten prospects should never crowd out a page match. */
const GROUP_LIMIT = 10

/** Long enough to skip the intermediate states of a typed word, short enough
    that the list still feels attached to the keyboard. */
const DEBOUNCE_MS = 150

/**
 * Pages that exist as routes but render nothing. Offering a shortcut to a blank
 * screen is worse than not offering one, so they are excluded by name here even
 * though their NAV_ITEMS entries are otherwise reachable. Delete a name from
 * this set the phase its page is built.
 */
const UNBUILT_PAGES = new Set(['Announcements'])

/**
 * A query with no letters in it is a phone query. Without this, typing a
 * business name that happens to contain a digit would also run the number
 * match and drag in unrelated rows.
 */
const PHONE_QUERY = /^[\d\s()+./-]+$/

interface SearchRecord {
  id: string
  label: string
  /** Second line: the number as stored, or a username. Never invented. */
  sublabel: string
  /** Lowercased text, substring-matched. */
  haystack: string
  /** One key per stored number — a row holding two is findable by either. */
  phoneKeys: string[]
}

interface Result {
  key: string
  label: string
  sublabel: string
  icon: LucideIcon
  to: string
}

interface Group {
  key: string
  label: string
  results: Result[]
}

/**
 * `phone` is one free-text column that may hold two numbers joined by "/", so
 * it is split before normalising — the same order every other phone consumer in
 * this app uses. `alias` is a second searchable string (a username) shown in
 * place of a number.
 */
function toRecord(
  id: string,
  label: string | null,
  phone: string | null,
  alias: string | null = null
): SearchRecord {
  const name = (label ?? '').trim() || 'Unnamed'
  const extra = (alias ?? '').trim()
  return {
    id,
    label: name,
    sublabel: extra || (phone ?? '').trim(),
    haystack: (extra ? `${name} ${extra}` : name).toLowerCase(),
    phoneKeys: splitPhones(phone).map(phoneSearchKey).filter(Boolean),
  }
}

function matchesRecord(record: SearchRecord, text: string, digits: string): boolean {
  if (record.haystack.includes(text)) return true
  return digits !== '' && record.phoneKeys.some((key) => key.includes(digits))
}

function describeError(error: unknown): { message: string; status: number } {
  const status = error instanceof SupabaseError ? error.status : 0
  if (status === 401) return { message: 'Your session expired. Sign in again to search.', status }
  return { message: `Couldn't load the search index. Check your connection.`, status }
}

/**
 * ⌘K / Ctrl+K from anywhere.
 *
 * The index is fetched once on first open and filtered in memory from then on:
 * a keystroke must never become a round trip, and 681 prospects + 196 leads is
 * a few hundred KB of two columns each. Everything it reads is RLS-scoped, so a
 * rep searching finds their own rows and a CEO finds all of them without this
 * component knowing anything about rep identity.
 *
 * Role is only ever consulted through `canAccessPath`, never by comparing to a
 * literal: the palette offers exactly the pages the router would let you into.
 *
 * `open` is owned by AppShell rather than by this component, because ⌘K is not
 * the only door: the top bar's search box is the same door, and on a phone it
 * is the *only* one. Both must drive one piece of state or one of them ends up
 * opening a second, stale palette.
 */
export function CommandPalette({
  open,
  setOpen,
}: {
  open: boolean
  /** Takes the updater form — the ⌘K listener below toggles from a stale closure. */
  setOpen: Dispatch<SetStateAction<boolean>>
}) {
  const navigate = useNavigate()
  const { role } = useAuth()

  // Sticky: closing the palette must not throw the index away, or every reopen
  // pays for the full fetch again.
  const [everOpened, setEverOpened] = useState(false)
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // `sales_users` is readable by every authenticated user — its SELECT policy
  // is `true` — so RLS will not hide the roster. This check is what does.
  const canSeePeople = canAccessPath(role, '/team')

  const prospects = usePaletteProspects(everOpened)
  const leads = usePaletteLeads(everOpened)
  const people = usePalettePeople(everOpened && canSeePeople)

  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
        return
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setOpen])

  // Hangs off `open` itself rather than off the ⌘K handler, so opening from the
  // top bar's search box arms the fetch too — on a phone that is the only way
  // in. The one frame where this is still false renders the skeleton, not a
  // zeroed counts line, because `loading` below waits on the data itself.
  useEffect(() => {
    if (open) setEverOpened(true)
  }, [open])

  // A reopened palette starts blank rather than showing the last search's hits.
  useEffect(() => {
    if (open) return
    setInput('')
    setQuery('')
    setSelected(0)
  }, [open])

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [input])

  useEffect(() => {
    setSelected(0)
  }, [query])

  const prospectRecords = useMemo(
    () => (prospects.data ?? []).map((r: PaletteProspect) => toRecord(r.id, r.name, r.phone)),
    [prospects.data]
  )
  const leadRecords = useMemo(
    () => (leads.data ?? []).map((r: PaletteLead) => toRecord(r.id, r.biz, r.phone)),
    [leads.data]
  )
  const personRecords = useMemo(
    () => (people.data ?? []).map((r: PalettePerson) => toRecord(String(r.id), r.name, null, r.username)),
    [people.data]
  )

  const text = query.trim().toLowerCase()
  const digits = PHONE_QUERY.test(query.trim()) ? phoneSearchKey(query) : ''

  const groups = useMemo<Group[]>(() => {
    if (!text) return []
    const out: Group[] = []

    const nav = NAV_ITEMS.filter(
      (item) =>
        // `hidden` items are reached from inside another page on purpose; the
        // palette is an advertisement surface like the sidebar, so it skips them.
        !item.hidden &&
        !UNBUILT_PAGES.has(item.label) &&
        canAccessPath(role, item.path) &&
        item.label.toLowerCase().includes(text)
    )
      .slice(0, GROUP_LIMIT)
      .map<Result>((item) => ({
        key: `nav:${item.path}`,
        label: item.label,
        sublabel: item.path,
        icon: item.icon,
        to: item.path,
      }))
    if (nav.length > 0) out.push({ key: 'nav', label: 'Navigation', results: nav })

    function hits(records: SearchRecord[]): SearchRecord[] {
      return records.filter((r) => matchesRecord(r, text, digits)).slice(0, GROUP_LIMIT)
    }

    const prospectHits = hits(prospectRecords).map<Result>((r) => ({
      key: `prospect:${r.id}`,
      label: r.label,
      sublabel: r.sublabel,
      icon: Users,
      to: `/prospects?focus=${encodeURIComponent(r.id)}`,
    }))
    if (prospectHits.length > 0) {
      out.push({ key: 'prospects', label: 'Prospects', results: prospectHits })
    }

    const leadHits = hits(leadRecords).map<Result>((r) => ({
      key: `lead:${r.id}`,
      label: r.label,
      sublabel: r.sublabel,
      icon: Flame,
      to: `/pipeline?focus=${encodeURIComponent(r.id)}`,
    }))
    if (leadHits.length > 0) {
      out.push({ key: 'leads', label: 'Interested leads', results: leadHits })
    }

    if (canSeePeople) {
      const personHits = hits(personRecords).map<Result>((r) => ({
        key: `person:${r.id}`,
        label: r.label,
        sublabel: r.sublabel,
        icon: UserCog,
        to: '/team',
      }))
      if (personHits.length > 0) {
        out.push({ key: 'people', label: 'People', results: personHits })
      }
    }

    return out
  }, [text, digits, role, canSeePeople, prospectRecords, leadRecords, personRecords])

  const flat = useMemo(() => groups.flatMap((g) => g.results), [groups])
  const activeIndex = flat.length === 0 ? -1 : Math.min(selected, flat.length - 1)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  /**
   * Counts come from the cached arrays, never from a constant. If a fetch is
   * ever truncated back to PostgREST's 500-row cap this line says 500 and the
   * bug is visible on open, instead of 181 prospects quietly never matching.
   */
  const indexSummary = useMemo(() => {
    const parts = [
      `${prospectRecords.length.toLocaleString('en-US')} ${prospectRecords.length === 1 ? 'prospect' : 'prospects'}`,
      `${leadRecords.length.toLocaleString('en-US')} ${leadRecords.length === 1 ? 'lead' : 'leads'}`,
    ]
    if (canSeePeople) {
      parts.push(
        `${personRecords.length.toLocaleString('en-US')} ${personRecords.length === 1 ? 'person' : 'people'}`
      )
    }
    return `Search ${parts.join(' · ')}`
  }, [prospectRecords.length, leadRecords.length, personRecords.length, canSeePeople])

  function activate(result: Result) {
    setOpen(false)
    navigate(result.to)
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (flat.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((activeIndex + 1) % flat.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((activeIndex - 1 + flat.length) % flat.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const result = flat[activeIndex]
      if (result) activate(result)
    }
  }

  if (!open) return null

  const error = prospects.error ?? leads.error ?? people.error ?? null
  /*
    Deliberately not `isLoading`: a query that has only just been enabled
    reports neither loading nor data for a frame, and the counts line below is
    only honest once the arrays actually exist. Waiting on the data itself
    closes that gap — a flash of "Search 0 prospects · 0 leads" is precisely the
    silently-wrong number that line was added to make impossible.
  */
  const loading =
    prospects.data === undefined ||
    leads.data === undefined ||
    (canSeePeople && people.data === undefined)

  let body
  if (error) {
    // §8: an error is never rendered as "nothing found".
    body = (
      <div className="p-3">
        <ErrorState
          {...describeError(error)}
          onRetry={() => {
            void prospects.refetch()
            void leads.refetch()
            if (canSeePeople) void people.refetch()
          }}
        />
      </div>
    )
  } else if (loading) {
    body = (
      <div className="flex flex-col gap-2 p-3" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    )
  } else if (!text) {
    body = <p className="px-4 py-6 text-center text-sm text-text-muted">{indexSummary}</p>
  } else if (flat.length === 0) {
    body = (
      <div className="p-3">
        <EmptyState
          message={`No ${
            canSeePeople ? 'prospects, leads, people or pages' : 'prospects, leads or pages'
          } match "${query.trim()}".`}
        />
      </div>
    )
  } else {
    let index = -1
    body = (
      <div id="palette-results" role="listbox" aria-label="Search results" className="p-2">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="mt-2 mb-1 px-2 text-2xs text-text-subtle first:mt-0">{group.label}</div>
            {group.results.map((result) => {
              index += 1
              const isSelected = index === activeIndex
              const Icon = result.icon
              return (
                <button
                  key={result.key}
                  id={`palette-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  ref={isSelected ? selectedRef : undefined}
                  onClick={() => activate(result)}
                  onMouseMove={() => setSelected(flat.indexOf(result))}
                  className={clsx(
                    'flex h-9 w-full items-center gap-2.5 rounded-sm px-2 text-left transition-colors duration-[120ms] motion-reduce:transition-none',
                    isSelected ? 'bg-brand-ghost text-brand' : 'text-text hover:bg-surface-2'
                  )}
                >
                  <Icon size={16} strokeWidth={1.75} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">{result.label}</span>
                  {result.sublabel && (
                    <span className="shrink-0 truncate text-xs text-text-subtle">
                      {result.sublabel}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      // px-4: on a phone the panel is the full width of the viewport, and
      // without this its rounded corners and border run off both edges.
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="animate-palette-in w-full max-w-lg rounded-md border border-border bg-surface shadow-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search size={16} strokeWidth={1.75} className="text-text-subtle" />
          <input
            autoFocus
            type="text"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="palette-results"
            aria-activedescendant={activeIndex >= 0 ? `palette-option-${activeIndex}` : undefined}
            placeholder="Search prospects, leads and pages…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onInputKeyDown}
            className="h-6 w-full bg-transparent text-base text-text outline-none placeholder:text-text-subtle"
          />
        </div>
        <div className="max-h-[52vh] overflow-y-auto">{body}</div>
      </div>
    </div>
  )
}
