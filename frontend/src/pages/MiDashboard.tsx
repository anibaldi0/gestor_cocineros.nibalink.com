import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { etiquetaEstado } from '../lib/colores'
import { formatFecha } from '../lib/format'
import type { DashboardEmpleado, TurnoMes } from '../lib/types'
import { useAuth } from '../lib/use-auth'

export default function MiDashboard() {
  const { user } = useAuth()
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [data, setData] = useState<DashboardEmpleado | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<
    'turnos' | 'francos' | 'feriados' | 'limpieza'
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

  function mesAnterior() {
    if (mes === 1) {
      setMes(12)
      setAnio(anio - 1)
    } else {
      setMes(mes - 1)
    }
  }

  function mesSiguiente() {
    if (mes === 12) {
      setMes(1)
      setAnio(anio + 1)
    } else {
      setMes(mes + 1)
    }
  }

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

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={mesAnterior}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200"
        >
          {'<'}
        </button>
        <span className="text-sm font-medium min-w-[100px] text-center">
          {mesNombre(mes)} {anio}
        </span>
        <button
          onClick={mesSiguiente}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200"
        >
          {'>'}
        </button>
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
            ['limpieza', 'Limpieza'],
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

      {tab === 'turnos' && (
        <ListaTurnos turnos={data.turnos} />
      )}

      {tab === 'francos' && (
        <ListaFrancos data={data} />
      )}

      {tab === 'feriados' && (
        <ListaFeriados data={data} />
      )}

      {tab === 'limpieza' && <ListaLimpieza />}
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

function ListaTurnos({ turnos }: { turnos: TurnoMes[] }) {
  if (turnos.length === 0) {
    return (
      <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-6 text-center">
        No hay turnos cargados este mes.
      </p>
    )
  }
  return (
    <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      {turnos.map((t) => (
        <li
          key={t.fecha}
          className="px-4 py-3 flex items-start justify-between gap-3"
        >
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="text-sm text-sky-700 font-medium shrink-0">
              {formatFecha(t.fecha)}
            </span>
            <span className="text-base font-semibold text-slate-900 truncate">
              {t.estado === 'TRABAJO'
                ? `TRABAJO - ${t.codigo_corto ?? ''} ${t.hora_inicio ?? ''}-${t.hora_fin ?? ''} (${t.horas}hs)`
                : t.estado === 'FRANCO'
                  ? t.es_franco_protegido
                    ? `FRANCO PROTEGIDO (${t.nota ?? 'sin nota'})`
                    : 'FRANCO'
                  : etiquetaEstado[t.estado]}
            </span>
          </div>
          {t.horas_extra > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 whitespace-nowrap">
              +{t.horas_extra} HE
            </span>
          )}
        </li>
      ))}
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


function ListaLimpieza() {
  // Placeholder hasta que exista el chunk de limpieza.
  // Dejo el mismo patron visual que Turnos/Francos/Feriados para que
  // cuando lleguen los datos reales sea solo reemplazar el array.
  const items: { fecha: string; tarea: string }[] = []
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-6 text-center">
        Proximamente vas a ver aca tus fechas de limpieza.
      </p>
    )
  }
  return (
    <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      {items.map((it) => (
        <li
          key={it.fecha}
          className="px-4 py-3 flex items-baseline gap-3 min-w-0"
        >
          <span className="text-sm text-sky-700 font-medium shrink-0">
            {formatFecha(it.fecha)}
          </span>
          <span className="text-base font-semibold text-slate-900 truncate">
            {it.tarea}
          </span>
        </li>
      ))}
    </ul>
  )
}
