// Contexte d'authentification : expose l'utilisateur courant, ses préférences et les actions
// de session. Au montage, tente de restaurer la session via GET /api/me.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import * as api from '../services/api'
import { DEFAULT_SETTINGS, type User, type UserSettings } from '../types'

interface AuthContextValue {
  user: User | null
  settings: UserSettings
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  setUser: (u: User) => void
  setSettings: (s: UserSettings) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { user: u, settings: s } = await api.getMe()
      setUser(u)
      setSettings(s)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    await api.login(email, password)
    await refresh()
  }, [refresh])

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      await api.register(email, password, displayName)
      await refresh()
    },
    [refresh]
  )

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined)
    setUser(null)
    setSettings(DEFAULT_SETTINGS)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, settings, loading, login, register, logout, refresh, setUser, setSettings }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider.')
  return ctx
}
