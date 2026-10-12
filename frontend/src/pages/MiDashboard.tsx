import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { etiquetaEstado } from '../lib/colores'
import { formatFecha } from '../lib/format'
import type { DashboardEmpleado, LimpiezaEmpleado, TurnoMes } from '../lib/types'
import { useAuth } from '../lib/use-auth'

export default function MiDashboard() {
  const { user } = useAuth()
  const hoy = new Date()
  // El empleado solo ve el mes actual. No hay navegacion.
  const anio = hoy.getFullYear()
  const mes = hoy.getMonth() + 1
  const [data, setData] = useState<DashboardEmpleado | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<
    'turnos' | 'francos' | 'feriados'
  >('turnos')

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      setData(await api.miDashboard(anio, mes))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes])

  if (loading)
    return <p className="text-sm text-slate-500">Cargando tu dashboard...</p>
  if (error)
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error}
      </p>
    )
  if (!data) return null

  const { empleado, stats } = data

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {user?.username ?? empleado.nombre}
        </h1>
        <p className="text-sm text-slate-500">
          Tu resumen de {mesNombre(mes)} {anio}.
        </p>
      </header>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-900">
        La grilla oficial esta publicada en la pizarra y en esta pantalla.
        Es responsabilidad de cada empleado consultarla.
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-800">
          {mesNombre(mes)} {anio}
        </h2>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatCard label="Dias trab." value={stats.dias_trabajados} />
        <StatCard label="Horas" value={stats.horas_totales.toFixed(1)} />
        <StatCard label="Horas extra" value={stats.horas_extra.toFixed(1)} />
        <StatCard label="Francos" value={stats.francos} />
        <StatCard label="Vacaciones" value={stats.vacaciones_tomadas} />
        <StatCard label="Licencias" value={stats.licencias} />
      </section>

      <nav className="flex gap-1 overflow-x-auto bg-white rounded-xl border border-slate-200 p-1">
        {(
          [
            ['turnos', 'Turnos'],
            ['francos', `Francos (${data.francos.length})`],
            ['feriados', `Feriados (${data.feriados_trabajados.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === k
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'turnos' && <ListaTurnos data={data} />}

      {tab === 'francos' && (
        <ListaFrancos data={data} />
      )}

      {tab === 'feriados' && (
        <ListaFeriados data={data} />
      )}


    </div>
  )
}

function mesNombre(m: number): string {
  return (
    [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ][m - 1] ?? String(m)
  )
}

function StatCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string
  value: string | number
  hint?: string
  highlight?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-3 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div
        className={`text-lg font-semibold ${
          highlight ? 'text-red-700' : 'text-slate-900'
        }`}
      >
        {value}
      </div>
      {hint && (
        <div className="text-xs text-slate-400 mt-0.5">{hint}</div>
      )}
    </div>
  )
}

function ListaTurnos({ data }: { data: DashboardEmpleado }) {
  const turnos = data.turnos
  if (turnos.length === 0) {
    return (
      <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-6 text-center">
        No hay turnos cargados este mes.
      </p>
    )
  }

  // Indice de limpieza por fecha.
  const limpiezaPorFecha = new Map(
    (data.limpieza ?? []).map((l) => [l.fecha, l]),
  )

  return (
    <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      {turnos.map((t) => {
        const limpieza = limpiezaPorFecha.get(t.fecha)
        return (
          <li
            key={t.fecha}
            className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1"
          >
            <span className="text-sm text-sky-700 font-medium shrink-0">
              {formatFecha(t.fecha)}
            </span>
            <span className="text-base font-semibold text-slate-900 truncate flex-1 min-w-0">
              {t.estado === 'TRABAJO'
                ? `TRABAJO - ${t.codigo_corto ?? ''} ${t.hora_inicio ?? ''}-${t.hora_fin ?? ''} (${t.horas}hs)`
                : t.estado === 'FRANCO'
                  ? t.es_franco_protegido
                    ? `FRANCO PROTEGIDO (${t.nota ?? 'sin nota'})`
                    : 'FRANCO'
                  : etiquetaEstado[t.estado]}
            </span>
            {limpieza && (
              <span
                className="text-xs px-2 py-1 rounded-full text-white font-semibold whitespace-nowrap"
                style={{ backgroundColor: limpieza.tipo_tarea_color }}
              >
                {limpieza.tipo_tarea_nombre}
              </span>
            )}
            {t.horas_extra > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 whitespace-nowrap">
                +{t.horas_extra} HE
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ListaFrancos({ data }: { data: DashboardEmpleado }) {
  if (data.francos.length === 0) {
    return (
      <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-6 text-center">
        No tenes francos este mes.
      </p>
    )
  }
  return (
    <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      {data.francos.map((f) => (
        <li
          key={f.fecha}
          className="px-4 py-3 flex items-baseline gap-3 min-w-0"
        >
          <span className="text-sm text-sky-700 font-medium shrink-0">
            {formatFecha(f.fecha)}
          </span>
          <span className="text-base font-semibold text-slate-900 truncate">
            {f.es_franco_protegido
              ? `FRANCO PROTEGIDO${f.nota ? ` (${f.nota})` : ''}`
              : 'FRANCO'}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ListaFeriados({ data }: { data: DashboardEmpleado }) {
  if (data.feriados_trabajados.length === 0) {
    return (
      <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-6 text-center">
        No tenes feriados trabajados este mes.
      </p>
    )
  }
  return (
    <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      {data.feriados_trabajados.map((f) => (
        <li
          key={f.fecha}
          className="px-4 py-3 flex items-baseline gap-3 min-w-0"
        >
          <span className="text-sm text-sky-700 font-medium shrink-0">
            {formatFecha(f.fecha)}
          </span>
          <span className="text-base font-semibold text-slate-900 truncate">
            {f.nombre_evento} - {f.codigo_corto ?? ''} {f.horas}hs
          </span>
        </li>
      ))}
    </ul>
  )
}
