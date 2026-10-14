import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type { UsuarioDetalle } from '../lib/types'
import { useAuth } from '../lib/use-auth'

export default function Usuarios() {
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioDetalle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)

  const puedeCrear =
    user?.roles.includes('EDITOR') || user?.roles.includes('SUPERADMIN')

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const params: { activo?: boolean; q?: string } = {}
      if (soloActivos) params.activo = true
      if (q.trim()) params.q = q.trim()
      setUsuarios(await api.usuarios(params))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloActivos])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Gestores</h1>
        {puedeCrear && (
          <Link
            to="/usuarios/nuevo"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium active:bg-slate-800"
          >
            + Nuevo gestor
          </Link>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void cargar()
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <input
          type="search"
          placeholder="Buscar por username"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 px-2">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
            className="rounded"
          />
          Solo activos
        </label>
        <button
          type="submit"
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
        >
          Buscar
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando...</p>
      ) : usuarios.length === 0 ? (
        <p className="text-sm text-slate-500">No hay gestores para mostrar.</p>
      ) : (
        <>
          <ul className="space-y-2 sm:hidden">
            {usuarios.map((u) => (
              <li key={u.id}>
                <Link
                  to={`/usuarios/${u.id}`}
                  className="block bg-white rounded-xl border border-slate-200 p-4 active:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{u.username}</p>
                      <p className="text-sm text-slate-500">
                        {u.roles.join(', ')}
                      </p>
                      {u.empleado_nombre && (
                        <p className="text-xs text-slate-400 truncate">
                          {u.empleado_nombre}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {!u.activo && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          Inactivo
                        </span>
                      )}
                      <span
                        className={
                          u.debe_cambiar_password
                            ? 'text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800'
                            : 'text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500'
                        }
                      >
                        {u.debe_cambiar_password ? 'Temporal' : 'Modificada'}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Username</th>
                  <th className="text-left px-4 py-2 font-medium">Rol</th>
                  <th className="text-left px-4 py-2 font-medium">Empleado</th>
                  <th className="text-left px-4 py-2 font-medium">Estado</th>
                  <th className="text-left px-4 py-2 font-medium">Pass</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <Link
                        to={`/usuarios/${u.id}`}
                        className="text-slate-900 hover:underline"
                      >
                        {u.username}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {u.roles.join(', ')}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {u.empleado_nombre ?? '-'}
                    </td>
                    <td className="px-4 py-2">
                      {u.activo ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                          Activo
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {u.debe_cambiar_password ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Temporal
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                          Modificada
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
