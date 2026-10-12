import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type { EmpleadoVacaciones, ListadoVacaciones } from '../lib/types'
import { useAuth } from '../lib/use-auth'

export default function Vacaciones() {
  const { user } = useAuth()
  const esSuper = user?.roles.includes('SUPERADMIN') ?? false
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [data, setData] = useState<ListadoVacaciones | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      setData(await api.listadoVacaciones(anio))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio])

  if (loading) return <p className="text-sm text-slate-500">Cargando...</p>
  if (error)
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error}
      </p>
    )
  if (!data) return null

  const pendientesTotales = data.empleados.reduce(
    (acc, e) => acc + (e.dias_pendientes ?? 0),
    0,
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vacaciones</h1>
          <p className="text-sm text-slate-500">
            Saldos anuales y periodos cargados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnio(anio - 1)}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200"
          >
            {'<'}
          </button>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {anio}
          </span>
          <button
            onClick={() => setAnio(anio + 1)}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200"
          >
            {'>'}
          </button>
        </div>
      </div>

      {esSuper && (
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-sm text-slate-600">
            Cerrar el anio {anio}: cada empleado con saldo se cierra y se
            decide que hacer con los pendientes.
          </div>
          <Link
            to={`/vacaciones/cerrar/${anio}`}
            className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-medium whitespace-nowrap"
          >
            Cerrar anio
          </Link>
        </div>
      )}

      <div className="text-sm text-slate-500">
        Pendientes en el anio: <strong>{pendientesTotales}</strong>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Mobile: cards */}
        <ul className="sm:hidden divide-y divide-slate-100">
          {data.empleados.map((e) => (
            <li key={e.empleado_id}>
              <Link
                to={`/vacaciones/${anio}/${e.empleado_id}`}
                className="block px-4 py-3 active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {e.apellido}, {e.nombre}
                    </p>
                    <p className="text-xs text-slate-500">DNI {e.dni}</p>
                  </div>
                  {e.dias_pendientes === null ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      Sin saldo
                    </span>
                  ) : (
                    <SaldoBadge
                      pendientes={e.dias_pendientes}
                      estado={e.estado ?? 'ABIERTA'}
                    />
                  )}
                </div>
                {e.dias_totales !== null && (
                  <div className="text-xs text-slate-500 mt-1">
                    {e.dias_tomados} de {e.dias_totales}
                    {e.modo_conteo === 'HABILES' ? ' habiles' : ' corridos'}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop: tabla */}
        <table className="hidden sm:table w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Empleado</th>
              <th className="text-left px-4 py-2 font-medium">DNI</th>
              <th className="text-right px-4 py-2 font-medium">Total</th>
              <th className="text-right px-4 py-2 font-medium">Tomados</th>
              <th className="text-right px-4 py-2 font-medium">Pendientes</th>
              <th className="text-left px-4 py-2 font-medium">Modo</th>
              <th className="text-left px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.empleados.map((e) => (
              <tr key={e.empleado_id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <Link
                    to={`/vacaciones/${anio}/${e.empleado_id}`}
                    className="text-slate-900 hover:underline"
                  >
                    {e.apellido}, {e.nombre}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{e.dni}</td>
                <td className="px-4 py-2 text-right">
                  {e.dias_totales ?? '-'}
                </td>
                <td className="px-4 py-2 text-right">{e.dias_tomados}</td>
                <td className="px-4 py-2 text-right">
                  {e.dias_pendientes === null ? (
                    <span className="text-xs text-slate-400">-</span>
                  ) : (
                    <SaldoBadge
                      pendientes={e.dias_pendientes}
                      estado={e.estado ?? 'ABIERTA'}
                      inline
                    />
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {e.modo_conteo === 'HABILES'
                    ? 'Habiles'
                    : e.modo_conteo === 'CORRIDOS'
                      ? 'Corridos'
                      : '-'}
                </td>
                <td className="px-4 py-2">
                  {e.estado ? (
                    e.estado === 'CERRADA' ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        Cerrado
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                        Abierto
                      </span>
                    )
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      Sin saldo
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SaldoBadge({
  pendientes,
  estado,
  inline = false,
}: {
  pendientes: number
  estado: 'ABIERTA' | 'CERRADA'
  inline?: boolean
}) {
  let clase = 'bg-green-50 text-green-700'
  if (estado === 'CERRADA') clase = 'bg-slate-100 text-slate-500'
  else if (pendientes < 0) clase = 'bg-red-100 text-red-800'
  else if (pendientes === 0) clase = 'bg-amber-100 text-amber-800'
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${clase} ${inline ? '' : 'whitespace-nowrap'}`}
    >
      {pendientes} dias
    </span>
  )
}
