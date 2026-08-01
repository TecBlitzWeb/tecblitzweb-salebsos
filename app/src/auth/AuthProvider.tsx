import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { canonicalRepKey } from '../lib/repKey'

export interface SalesUserProfile {
  id: number
  auth_user_id: string
  name: string
  username: string
  email: string
  role: string
  owned_reps: number[] | null
}

export interface SignInResult {
  error: string | null
  status?: number
}

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: SalesUserProfile | null
  role: string | null
  repKey: string
  loading: boolean
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<SalesUserProfile | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) {
      setProfile(null)
      return
    }

    let active = true
    setProfileLoading(true)

    supabase
      .from('sales_users')
      .select('id, auth_user_id, name, username, email, role, owned_reps')
      .eq('auth_user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setProfile(data as SalesUserProfile | null)
        setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [session?.user.id])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      repKey: canonicalRepKey(profile?.username),
      loading: sessionLoading || profileLoading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (!error) return { error: null }
        return { error: error.message, status: error.status }
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, profile, sessionLoading, profileLoading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
