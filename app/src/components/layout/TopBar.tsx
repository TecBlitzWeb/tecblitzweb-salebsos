import { useLocation } from 'react-router-dom'
import { Monitor, Moon, Search, Sun } from 'lucide-react'
import { NAV_ITEMS } from './navConfig'
import { useTheme, type ThemePreference } from './ThemeProvider'
import { Wordmark } from '../shared/Wordmark'

const THEME_CYCLE: ThemePreference[] = ['system', 'light', 'dark']
const THEME_META: Record<ThemePreference, { icon: typeof Monitor; label: string }> = {
  system: { icon: Monitor, label: 'System' },
  light: { icon: Sun, label: 'Light' },
  dark: { icon: Moon, label: 'Dark' },
}

/**
 * `navigator.platform` is deprecated and `userAgentData` isn't in Safari, so the
 * user-agent string is what's left. Read once — the OS does not change mid
 * session — and a wrong guess costs a wrong hint label, nothing more.
 */
const IS_APPLE = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
const SHORTCUT_HINT = IS_APPLE ? '⌘K' : 'Ctrl K'

export function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const location = useLocation()
  const { preference, setPreference } = useTheme()
  const title = NAV_ITEMS.find((item) => item.path === location.pathname)?.label ?? ''
  const ThemeIcon = THEME_META[preference].icon

  function cycleTheme() {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(preference) + 1) % THEME_CYCLE.length]
    setPreference(next)
  }

  return (
    <header className="flex h-12 items-center gap-3 border-b border-border bg-bg px-4 lg:px-6">
      {/* Desktop title */}
      <h1 className="hidden text-lg font-semibold text-text lg:block">{title}</h1>

      {/* Mobile: wordmark + page title */}
      <div className="shrink-0 lg:hidden">
        <Wordmark subtitle={title} />
      </div>

      {/*
        A button, not an input. Typing happens in the palette's own field, and a
        text box here would take focus, raise the phone keyboard, and then be
        replaced by the field you actually type into.

        Rendered at every breakpoint: ⌘K does not exist on a phone, so on touch
        this is the only way into search. It flexes to fill the mobile bar and
        is 44px tall there (DESIGN_RULES §6a touch target), fixed-width and 36px
        on desktop where it sits beside the theme toggle.

        w-72, not the w-64 the old disabled input used: the label needs 184px
        and w-64 leaves 170px, so it truncated to "…and lea". A placeholder that
        is itself cut off reads as a broken control.
      */}
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search prospects, leads and pages"
        aria-keyshortcuts="Meta+K Control+K"
        className="focus-ring ml-auto flex h-11 min-w-0 flex-1 items-center gap-2 rounded-sm border border-border-strong bg-surface px-2.5 text-left text-text-subtle transition-colors duration-[120ms] hover:border-brand/40 hover:text-text motion-reduce:transition-none lg:h-9 lg:w-72 lg:flex-none"
      >
        <Search size={16} strokeWidth={1.75} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-base lg:hidden">Search</span>
        <span className="hidden min-w-0 flex-1 truncate text-base lg:inline">
          Search prospects and leads
        </span>
        <kbd className="hidden shrink-0 rounded-sm border border-border-strong px-1.5 py-0.5 font-sans text-2xs text-text-subtle lg:inline-block">
          {SHORTCUT_HINT}
        </kbd>
      </button>

      <button
        type="button"
        title={THEME_META[preference].label}
        aria-label={`Theme: ${THEME_META[preference].label}`}
        onClick={cycleTheme}
        className="focus-ring hidden h-8 w-8 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text motion-reduce:transition-none lg:flex"
      >
        <ThemeIcon size={16} strokeWidth={1.75} />
      </button>
    </header>
  )
}
