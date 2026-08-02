import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './useAuth'
import type { Role } from '../components/layout/navConfig'

interface RequireRoleProps {
  allowed: Role[]
  children: ReactNode
}

// Renders in place rather than redirecting — the sidebar/top bar stay put,
// and there's nowhere for a loop to come from since no navigation happens.
export function RequireRole({ allowed, children }: RequireRoleProps) {
  const { role } = useAuth()

  if (!role || !allowed.includes(role as Role)) {
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
