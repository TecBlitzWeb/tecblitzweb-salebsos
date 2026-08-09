import { useState, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/shared/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAuth } from '../../auth/useAuth'

/** One read-only fact about the signed-in user. Text, never a control. */
function Row({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border px-3.5 py-3 last:border-b-0">
      <dt className="text-2xs uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value}</dd>
      {hint && <p className="text-2xs text-text-subtle">{hint}</p>}
    </div>
  )
}

function Missing({ label }: { label: string }) {
  return (
    <span className="text-text-subtle" title={`No ${label} on your sales_users row`}>
      —
    </span>
  )
}

/**
 * The signed-in user's own profile, and the way out.
 *
 * Everything here is read-only. Role and username are not editable anywhere in
 * this app: RLS matches role as an exact string ('CEO', 'Co-CEO') and
 * canonical_rep() derives rep identity from username, so a write to either
 * would remove someone's access or orphan their call history. Changes are made
 * in Supabase by someone who can see what they are breaking.
 */
export function SettingsPage() {
  const { profile, role, repKey, user, loading, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[280px] w-full max-w-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-xl flex-col gap-2">
        <h2 className="font-display text-lg text-text">Your profile</h2>

        {profile ? (
          <dl className="rounded-md border border-border bg-surface">
            <Row label="Name" value={profile.name?.trim() || <Missing label="name" />} />
            <Row
              label="Username"
              value={
                <span className="font-mono text-xs">
                  {profile.username?.trim() || <Missing label="username" />}
                </span>
              }
              hint="Read-only. Your entire call history is keyed from this."
            />
            <Row
              label="Email"
              value={profile.email?.trim() || user?.email || <Missing label="email" />}
            />
            <Row
              label="Role"
              value={
                <span className="inline-block rounded-sm bg-text-subtle/12 px-1.5 py-0.5 text-2xs text-text-muted">
                  {role?.trim() || 'No role'}
                </span>
              }
              hint="Read-only. This string decides which pages you can open."
            />
            <Row
              label="Canonical key"
              value={
                <span className="font-mono text-xs">
                  {repKey.trim() || <Missing label="canonical key" />}
                </span>
              }
              hint="Derived from your username. This is what your calls and prospects join on."
            />
          </dl>
        ) : (
          /*
            Signed in against auth, but no `sales_users` row matched this
            auth_user_id. Every role check and data filter keys off that row, so
            the app cannot say who this person is. Naming the cause beats
            rendering an empty profile.
          */
          <EmptyState message="You're signed in, but no sales_users row matches your account, so your role and data access can't be determined. Ask the CEO to link your account." />
        )}
      </section>

      <section className="flex max-w-xl flex-col gap-2">
        <h2 className="font-display text-lg text-text">Session</h2>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-sm text-text">Sign out</p>
            <p className="text-2xs text-text-subtle">
              Ends this session on this device. Nothing is deleted.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={signingOut}
            onClick={() => {
              setSigningOut(true)
              // RequireAuth redirects once the session clears, so this component
              // unmounts rather than needing to reset `signingOut`.
              void signOut()
            }}
          >
            Sign out
          </Button>
        </div>
      </section>
    </div>
  )
}
