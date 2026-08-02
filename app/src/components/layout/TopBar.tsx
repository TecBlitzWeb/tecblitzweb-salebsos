import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Monitor, Moon, Search, Sun, X } from 'lucide-react'
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
  const [searchOpen, setSearchOpen] = useState(false)
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
      <div className="flex flex-1 items-center gap-2 lg:hidden">
        {searchOpen ? (
          <>
            <Search size={16} strokeWidth={1.75} className="shrink-0 text-text-subtle" />
            <input
              autoFocus
              type="search"
              placeholder="Search…"
              className="focus-ring h-9 flex-1 rounded-sm border border-border-strong bg-surface px-3 text-base text-text outline-none"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={() => setSearchOpen(false)}
              className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-text-muted hover:bg-surface-2 hover:text-text"
            >
              <X size={20} strokeWidth={1.75} />
            </button>
          </>
        ) : (
          <>
            <div className="flex-1">
              <Wordmark subtitle={title} />
            </div>
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-text-muted hover:bg-surface-2 hover:text-text"
            >
              <Search size={20} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>

      {/* Desktop: persistent search + single theme toggle */}
      <div className="ml-auto hidden items-center gap-3 lg:flex">
        <div className="relative">
          <Search
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
          />
          <input
            type="search"
            placeholder="Search prospects, calls, leads…"
            className="focus-ring h-9 w-64 rounded-sm border border-border-strong bg-surface pl-8 pr-3 text-base text-text outline-none"
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
