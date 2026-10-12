import { useEffect, useState, type ReactNode } from 'react'
import { api, setToken } from './api'
import { AuthContext } from './auth-context'
import type { User } from './types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    try {
      const u = await api.me()
      setUser(u as User)
    } catch {
      setToken(null)
      setUser(null)
    }
  }

  useEffect(() => {
    void (async () => {
      if (localStorage.getItem('cocina_token')) {
        await refresh()
      }
      setLoading(false)
    })()
  }, [])

  async function login(username: string, password: string) {
    const res = await api.login(username, password)
    setToken(res.access_token)
    await refresh()
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
