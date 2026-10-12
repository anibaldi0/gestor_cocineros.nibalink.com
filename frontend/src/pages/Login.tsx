import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/use-auth'
import { ApiError } from '../lib/api'
import PasswordInput from '../components/PasswordInput'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4"
      >
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Gestion Cocina</h1>
          <p className="text-sm text-slate-500">Inicia sesion para continuar</p>
        </header>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Usuario</span>
          <input
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
            required
          />
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium disabled:opacity-50 active:bg-slate-800"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
