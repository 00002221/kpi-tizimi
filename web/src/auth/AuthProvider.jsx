import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = yuklanmoqda
  const [member, setMember] = useState(null)
  const [memberLoading, setMemberLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  const refresh = useCallback(async () => {
    if (!userId) { setMember(null); setMemberLoading(false); return }
    const { data } = await supabase
      .from('members')
      .select('*, company:companies(*)')
      .eq('user_id', userId)
      .maybeSingle()
    setMember(data ?? null)
    setMemberLoading(false)
  }, [userId])

  useEffect(() => {
    if (session === undefined) return
    setMemberLoading(true)
    refresh()
  }, [session === undefined, userId, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  const value = {
    session,
    user: session?.user ?? null,
    member,
    company: member?.company ?? null,
    loading: session === undefined || (Boolean(userId) && memberLoading),
    refresh,
    signOut,
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
