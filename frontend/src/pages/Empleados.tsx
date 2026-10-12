import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDNI } from '../lib/format'
import type { Empleado, EmpleadoUsuario } from '../lib/types'
import { useAuth } from '../lib/use-auth'

export default function Empleados() {
  const { user } = useAuth()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)

  const puedeEditar =
    user?.roles.includes('EDITOR') || user?.roles.includes('SUPERADMIN')

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (soloActivos) params.set('activo', 'true')
      if (q.trim()) params.set('q', q.trim())
      const data = await api.get<Empleado[]>(
        `/empleados${params.toString() ? `?${params}` : ''}`,
      )
      setEmpleados(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
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
        <h1 className="text-xl font-semibold tracking-tight">Empleados</h1>
        {puedeEditar && (
          <Link
            to="/empleados/nuevo"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium active:bg-slate-800"
          >
            + Nuevo empleado
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
          placeholder="Buscar por nombre, apellido o DNI"
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
      ) : empleados.length === 0 ? (
        <p className="text-sm text-slate-500">No hay empleados para mostrar.</p>
      ) : (
        <>
          <ul className="space-y-2 sm:hidden">
            {empleados.map((e) => (
              <li key={e.id}>
                <Link
                  to={`/empleados/${e.id}`}
                  className="block bg-white rounded-xl border border-slate-200 p-4 active:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {e.apellido}, {e.nombre}
                      </p>
                      <p className="text-sm text-slate-500">DNI {formatDNI(e.dni)}</p>
                      <div className="mt-1">
                        <PassBadge usuario={e.usuario} />
                      </div>
                    </div>
                    {!e.activo && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        Inactivo
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Apellido, Nombre</th>
                  <th className="text-left px-4 py-2 font-medium">DNI</th>
                  <th className="text-left px-4 py-2 font-medium">Ingreso</th>
                  <th className="text-left px-4 py-2 font-medium">Horas/sem</th>
                  <th className="text-left px-4 py-2 font-medium">Pass</th>
                  <th className="text-left px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <Link
                        to={`/empleados/${e.id}`}
                        className="text-slate-900 hover:underline"
                      >
                        {e.apellido}, {e.nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{formatDNI(e.dni)}</td>
                    <td className="px-4 py-2 text-slate-600">{e.fecha_ingreso}</td>
                    <td className="px-4 py-2 text-slate-600">{e.horas_semana_max}</td>
                    <td className="px-4 py-2">
                      <PassBadge usuario={e.usuario} />
                    </td>
                    <td className="px-4 py-2">
                      {e.activo ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                          Activo
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          Inactivo
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


function PassBadge({ usuario }: { usuario: EmpleadoUsuario | null }) {
  if (!usuario) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
        Sin usuario
      </span>
    )
  }
  if (!usuario.activo) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
        Usuario inactivo
      </span>
    )
  }
  if (usuario.debe_cambiar_password) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
        Temporal
      </span>
    )
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
      Modificada
    </span>
  )
}
