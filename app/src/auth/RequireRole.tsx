import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './useAuth'
import { canAccessPath } from '../components/layout/navConfig'

interface RequireRoleProps {
  /** The route being guarded. Its audience is looked up in NAV_ITEMS. */
  path: string
  children: ReactNode
}

// Renders in place rather than redirecting — the sidebar/top bar stay put,
// and there's nowhere for a loop to come from since no navigation happens.
//
// Takes the path rather than a roles array so this guard and every shortcut
// into the page resolve access through the one `canAccessPath` — passing roles
// in by hand let a caller supply a list that disagreed with NAV_ITEMS.
export function RequireRole({ path, children }: RequireRoleProps) {
  const { role } = useAuth()

  if (!canAccessPath(role, path)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-text-muted">You don&apos;t have access to this page.</p>
        <Link to="/" className="focus-ring rounded-sm text-sm text-brand hover:text-brand-hover">
          Go to Today
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
