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

export function TopBar() {
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

      {/* Mobile: wordmark + page title, or an expanded search field */}
      {/*
        The mobile search affordance is hidden rather than disabled: a magnifier
        that expands into a dead input wastes a tap and reads as broken. It
        returns in Phase 11 with the real thing behind it.
      */}
      <div className="flex flex-1 items-center gap-2 lg:hidden">
        <div className="flex-1">
          <Wordmark subtitle={title} />
        </div>
      </div>

      {/* Desktop: persistent search + single theme toggle */}
      <div className="ml-auto hidden items-center gap-3 lg:flex">
        <div className="relative">
          <Search
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
          />
          {/*
            Disabled until Phase 11 wires global search. An input that accepts
            typing and silently does nothing is the same defect as a button
            labelled "Add prospect" while writes aren't implemented — it lies
            about what the app can do.
          */}
          <input
            type="search"
            disabled
            title="Search comes in Phase 11"
            aria-label="Global search — comes in Phase 11"
            placeholder="Search comes in Phase 11"
            className="h-9 w-64 cursor-not-allowed rounded-sm border border-border-strong bg-surface pl-8 pr-3 text-base text-text-subtle opacity-60 outline-none"
          />
        </div>

        <button
          type="button"
          title={THEME_META[preference].label}
          aria-label={`Theme: ${THEME_META[preference].label}`}
          onClick={cycleTheme}
          className="focus-ring flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text motion-reduce:transition-none"
        >
          <ThemeIcon size={16} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  )
}
