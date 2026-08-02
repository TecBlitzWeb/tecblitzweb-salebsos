import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../auth/useAuth'
import { Wordmark } from '../shared/Wordmark'
import { NAV_GROUPS, visibleNavItems } from './navConfig'

const STORAGE_KEY = 'salesos-sidebar-collapsed'

function readCollapsed(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

function getInitials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function Sidebar() {
  const { profile, role, signOut } = useAuth()
  const items = visibleNavItems(role)
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed)

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleCollapsed()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      className={clsx(
        'flex h-screen flex-col border-r border-border bg-surface transition-[width] duration-[180ms] ease-out motion-reduce:transition-none',
        collapsed ? 'w-14' : 'w-[232px]'
      )}
    >
      <div className={clsx('flex items-center py-4', collapsed ? 'justify-center px-0' : 'px-4')}>
        {collapsed ? (
          <span className="text-lg font-semibold text-brand">B</span>
        ) : (
          <Wordmark subtitle="Sales OS" subtitleVariant="label" />
        )}
      </div>

      <nav className={clsx('flex-1 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')}>
        {NAV_GROUPS.map((group, groupIndex) => {
          const groupItems = items.filter((item) => item.group === group.key)
          if (groupItems.length === 0) return null

          return (
            <div key={group.key}>
              {collapsed ? (
                groupIndex > 0 && <div className="my-2 h-px bg-border" />
              ) : (
                <div
                  className={clsx(
                    'mt-5 mb-1.5 px-2 text-2xs text-text-subtle',
                    groupIndex === 0 && 'first:mt-0'
                  )}
                >
                  {group.label}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {groupItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        clsx(
                          'focus-ring flex h-[34px] items-center rounded-sm text-sm transition-colors duration-[120ms] motion-reduce:transition-none',
                          collapsed ? 'justify-center' : 'gap-2 border-l-2 px-2',
                          isActive
                            ? collapsed
                              ? 'bg-brand-ghost text-brand'
                              : 'border-brand bg-brand-ghost text-brand'
                            : clsx(
                                'text-text-muted hover:bg-surface-2 hover:text-text',
                                !collapsed && 'border-transparent'
                              )
                        )
                      }
                    >
                      <Icon size={16} strokeWidth={1.75} />
                      {!collapsed && item.label}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className={clsx('border-t border-border py-3', collapsed ? 'px-2' : 'px-4')}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              title={`${profile?.name ?? '—'} · ${role ?? '—'}`}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-xs font-medium text-text"
            >
              {getInitials(profile?.name)}
            </div>
            <button
              type="button"
              title="Sign out"
              onClick={() => signOut()}
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text motion-reduce:transition-none"
            >
              <LogOut size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              title="Expand sidebar"
              onClick={toggleCollapsed}
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-sm text-text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text motion-reduce:transition-none"
            >
              <PanelLeftOpen size={16} strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <>
            <div className="text-sm text-text">{profile?.name ?? '—'}</div>
            <div className="text-xs text-text-muted">{role ?? '—'}</div>
            <div className="mt-3 flex items-center gap-1">
              <button
                type="button"
                onClick={() => signOut()}
                className="focus-ring flex h-8 flex-1 items-center gap-2 rounded-sm px-2 text-sm text-text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text motion-reduce:transition-none"
              >
                <LogOut size={16} strokeWidth={1.75} />
                Sign out
              </button>
              <button
                type="button"
                title="Collapse sidebar"
                onClick={toggleCollapsed}
                className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text motion-reduce:transition-none"
              >
                <PanelLeftClose size={16} strokeWidth={1.75} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
