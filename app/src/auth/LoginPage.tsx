import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate, type Location } from 'react-router-dom'
import { useAuth } from './useAuth'

interface LocationState {
  from?: Location
}

function errorMessage(status: number | undefined, raw: string): string {
  if (status === 400 || status === 422) {
    return `Couldn't sign in (${status}). Check your email and password.`
  }
  if (status === 429) {
    return `Too many attempts (${status}). Wait a moment and try again.`
  }
  if (status) {
    return `Couldn't sign in (${status}). ${raw}`
  }
  return "Couldn't sign in. Check your connection and try again."
}

const inputClass =
  'mt-1 h-9 w-full rounded-sm border border-border-strong bg-bg px-3 text-base text-text outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

export function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    const from = (location.state as LocationState | null)?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = await signIn(email, password)
    setSubmitting(false)
    if (result.error) {
      setError(errorMessage(result.status, result.error))
      return
    }
    const from = (location.state as LocationState | null)?.from?.pathname ?? '/'
    navigate(from, { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-md border border-border bg-surface p-6"
      >
        <h1 className="text-xl font-semibold text-text">Sign in</h1>
        <p className="mt-1 text-sm text-text-muted">Sales OS v2</p>

        <label className="mt-6 block text-xs text-text-muted" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />

        <label className="mt-4 block text-xs text-text-muted" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 h-9 w-full rounded-sm bg-brand text-sm font-medium text-[#00181C] outline-none transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
