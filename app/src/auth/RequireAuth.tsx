import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

function AuthSkeleton() {
  return (
    <div className="flex min-h-screen bg-bg">
      <div className="hidden w-[232px] shrink-0 border-r border-border bg-surface md:block">
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-md bg-surface-2" />
        <div className="grid gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-md border border-border bg-surface" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <AuthSkeleton />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
