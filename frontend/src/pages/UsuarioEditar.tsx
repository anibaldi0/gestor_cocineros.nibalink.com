import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type { Rol, UsuarioDetalle } from '../lib/types'
import { useAuth } from '../lib/use-auth'

export default function UsuarioEditar() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [usuario, setUsuario] = useState<UsuarioDetalle | null>(null)
  const [username, setUsername] = useState('')
  const [rol, setRol] = useState<Rol>('EDITOR')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const u = await api.usuario(Number(id))
      setUsuario(u)
      setUsername(u.username)
      setRol(u.roles[0] ?? 'EDITOR')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return
    setError(null)

    const payload: { username?: string; rol?: Rol } = {}
    if (username.trim().toLowerCase() !== usuario.username) {
      payload.username = username.trim().toLowerCase()
    }
    if (rol !== usuario.roles[0]) {
      payload.rol = rol
    }

    if (Object.keys(payload).length === 0) {
      navigate(`/usuarios/${usuario.id}`, { replace: true })
      return
    }

    // Si cambia el rol, doble confirmacion (impacto de permisos).
    if (payload.rol) {
      const ok1 = window.confirm(
        `Vas a cambiar el rol de ${usuario.username} de ${usuario.roles.join(', ')} a ${payload.rol}. Esta accion cambia sus permisos. Confirmas?`,
      )
      if (!ok1) return
      const ok2 = window.confirm(
        'Confirmacion final: el cambio de rol queda registrado en auditoria. Confirmar?',
      )
      if (!ok2) return
    }

    setGuardando(true)
    try {
      await api.actualizarUsuario(usuario.id, payload)
      navigate(`/usuarios/${usuario.id}`, { replace: true })
    } catch (e) {
      if (e instanceof ApiError) setError(e.message)
      else setError('Error inesperado')
    } finally {
      setGuardando(false)
    }
  }

  if (loading)
    return <p className="text-sm text-slate-500">Cargando...</p>
  if (error && !usuario)
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error}
      </p>
    )
  if (!usuario) return null

  const esMismoUsuario = user?.id === usuario.id
  const rolActual = usuario.roles[0] ?? 'EDITOR'
  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-900'
  const labelCls = 'block space-y-1'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => navigate(`/usuarios/${usuario.id}`)}
        className="text-sm text-slate-500 hover:underline"
      >
        {'<-'} Volver al detalle
      </button>

      <h1 className="text-xl font-semibold tracking-tight">Editar usuario</h1>

      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4"
      >
        <label className={labelCls}>
          <span className="text-sm font-medium text-slate-700">
            Username *
          </span>
          <input
            className={inputCls}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            maxLength={60}
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
          <span className="text-xs text-slate-400">
            Se guarda en minusculas.
          </span>
        </label>

        <label className={labelCls}>
          <span className="text-sm font-medium text-slate-700">Rol *</span>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
            disabled={esMismoUsuario}
            className={`${inputCls} ${esMismoUsuario ? 'disabled:opacity-60 disabled:bg-slate-50' : ''}`}
          >
            <option value="EDITOR">Editor</option>
            <option value="SUPERADMIN">Superadmin</option>
          </select>
          {esMismoUsuario && (
            <span className="text-xs text-slate-400">
              No podes cambiar tu propio rol.
            </span>
          )}
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="submit"
            disabled={guardando}
            className="w-full sm:w-auto rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/usuarios/${usuario.id}`)}
            className="w-full sm:w-auto rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
