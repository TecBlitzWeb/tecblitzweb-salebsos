import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../auth/useAuth'
import { NAV_GROUPS, NAV_ITEMS, visibleNavItems } from './navConfig'

const TAB_PATHS = ['/', '/prospects', '/calls', '/followups']

// Short labels for the tab bar only — navConfig's canonical labels ("My
// Calls", "Follow-ups") are too wide to fit five columns without wrapping.
const TAB_LABELS: Record<string, string> = {
  '/': 'Today',
  '/prospects': 'Prospects',
  '/calls': 'Calls',
  '/followups': 'Follow up',
}

export function MobileNav() {
  const location = useLocation()
  const { profile, role, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const items = visibleNavItems(role)
  const tabs = TAB_PATHS.map((path) => NAV_ITEMS.find((item) => item.path === path)).filter(
    (item): item is NonNullable<typeof item> => Boolean(item)
  )
  const overflowItems = items.filter((item) => !TAB_PATHS.includes(item.path))

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-border bg-surface lg:hidden">
        {tabs.map((item) => {
          const Icon = item.icon
          const isActive =
            item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={clsx(
                'focus-ring flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 border-t-2',
                isActive ? 'border-brand' : 'border-transparent'
              )}
            >
              <Icon size={20} strokeWidth={1.75} className={isActive ? 'text-brand' : 'text-text-muted'} />
              <span
                className={clsx(
                  'whitespace-nowrap text-2xs',
                  isActive ? 'text-brand' : 'text-text-muted'
                )}
              >
                {TAB_LABELS[item.path]}
              </span>
            </NavLink>
          )
        })}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="focus-ring flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 border-t-2 border-transparent"
        >
          <Menu size={20} strokeWidth={1.75} className="text-text-muted" />
          <span className="whitespace-nowrap text-2xs text-text-muted">Menu</span>
        </button>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="animate-sheet-in absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-lg border-t border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-lg font-semibold text-text">Menu</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="focus-ring flex h-8 w-8 items-center justify-center rounded-sm text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>

            <div className="px-3 py-2">
              {NAV_GROUPS.map((group) => {
                const groupItems = overflowItems.filter((item) => item.group === group.key)
                if (groupItems.length === 0) return null
                return (
                  <div key={group.key} className="py-2">
                    <div className="px-2 pb-1 text-2xs text-text-subtle">{group.label}</div>
                    {groupItems.map((item) => {
                      const Icon = item.icon
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={() => setMenuOpen(false)}
                          className="focus-ring flex min-h-[44px] items-center gap-2 rounded-sm px-2 text-sm text-text-muted hover:bg-surface-2 hover:text-text"
                        >
                          <Icon size={16} strokeWidth={1.75} />
                          {item.label}
                        </NavLink>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            <div className="border-t border-border px-4 py-3">
              <div className="text-sm text-text">{profile?.name ?? '—'}</div>
              <div className="text-xs text-text-muted">{role ?? '—'}</div>
              <button
                type="button"
                onClick={() => signOut()}
                className="focus-ring mt-3 flex min-h-[44px] w-full items-center gap-2 rounded-sm px-2 text-sm text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <LogOut size={16} strokeWidth={1.75} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
