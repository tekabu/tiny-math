import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from './api'
import type { User } from './types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<User>
  setup: (displayName: string, username: string, password: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => Boolean(getToken()))

  useEffect(() => {
    if (!getToken()) return
    api<User>('/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const clear = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  // any 401 (expired session, password reset) drops back to login
  useEffect(() => {
    window.addEventListener('tiny-math-logout', clear)
    return () => window.removeEventListener('tiny-math-logout', clear)
  }, [clear])

  const start = (res: { token: string; user: User }) => {
    setToken(res.token)
    setUser(res.user)
    return res.user
  }

  const login = async (username: string, password: string) =>
    start(await api<{ token: string; user: User }>('/login', 'POST', { username, password }))

  const setup = async (displayName: string, username: string, password: string) =>
    start(await api<{ token: string; user: User }>('/setup', 'POST', { displayName, username, password }))

  const logout = () => {
    void api('/logout', 'POST').catch(() => {})
    clear()
  }

  return <AuthContext.Provider value={{ user, loading, login, setup, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
