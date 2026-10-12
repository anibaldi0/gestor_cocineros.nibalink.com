import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/use-auth'
import PasswordInput from './PasswordInput'

interface Props {
  onDone: () => void
  onCancelar: () => void
}

export default function ModalChangePassword({ onDone, onCancelar }: Props) {
  const { user } = useAuth()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repite, setRepite] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (nueva.length < 6) {
      setError('La contrasena nueva debe tener al menos 6 caracteres')
      return
    }
    if (nueva !== repite) {
      setError('Las dos contrasenas nuevas no coinciden')
      return
    }
    if (nueva === actual) {
      setError('La contrasena nueva debe ser distinta a la actual')
      return
    }
    setLoading(true)
    try {
      await api.changePassword(actual, nueva)
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-900'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancelar}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Cambiar contrasena</h2>
            <p className="text-sm text-slate-500">Usuario: {user?.username}</p>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            aria-label="Cerrar"
            className="text-slate-400 hover:text-slate-600 text-xl leading-none -mt-1"
          >
            x
          </button>
        </header>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Contrasena actual
          </span>
          <PasswordInput
            value={actual}
            onChange={setActual}
            className={inputCls}
            required
            autoComplete="current-password"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Contrasena nueva
          </span>
          <PasswordInput
            value={nueva}
            onChange={setNueva}
            className={inputCls}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Repetir contrasena nueva
          </span>
          <PasswordInput
            value={repite}
            onChange={setRepite}
            className={inputCls}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium disabled:opacity-50"
          >
            {loading ? 'Cambiando...' : 'Cambiar contrasena'}
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="w-full rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
