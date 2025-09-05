import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'

type AuthContextType = {
  session: Session | null
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ session: null, user: null, loading: true })

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const value = useMemo(() => ({ session, user: session?.user ?? null, loading }), [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

export function Protected({ children }: PropsWithChildren) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/signin', { replace: true, state: { from: location.pathname } })
    }
  }, [user, loading, navigate, location])

  if (loading)
    return (
      <div className="min-h-[50vh] grid place-items-center text-sm text-muted-foreground">
        Loading...
      </div>
    )
  if (!user) return null
  return <>{children}</>
}

export function ProtectedOutlet() {
  return (
    <Protected>
      <Outlet />
    </Protected>
  )
}
