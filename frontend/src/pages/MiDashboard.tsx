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

  if (!data.puede_ver) {
    return (
      <div className="max-w-md mx-auto space-y-6 pt-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {user?.username}
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-900 space-y-2">
          <p className="text-lg font-medium">
            La grilla de este mes todavia no fue publicada.
          </p>
          <p className="text-sm">
            Cuando el editor la publique vas a poder ver tus turnos,
            francos, tareas y vacaciones aca.
          </p>
        </div>
        <button
          onClick={() => void cargar()}
          className="rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium"
        >
          Actualizar
        </button>
      </div>
    )
  }

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
        Es responsabilidad de cada uno consultarla.
      </div>

      <SeccionTareasHoy data={data} onRefresh={cargar} />

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

      {tab === 'turnos' && <ListaTurnos data={data} onRefresh={cargar} />}

      {tab === 'francos' && (
        <ListaFrancos data={data} />
      )}

      {tab === 'feriados' && (
        <ListaFeriados data={data} />
      )}


    </div>
  )
}

function SeccionTareasHoy({
  data,
  onRefresh,
}: {
  data: DashboardEmpleado
  onRefresh: () => Promise<void> | void
}) {
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fecha de hoy en formato ISO local (YYYY-MM-DD).
  const hoy = new Date()
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

  const todas = data.limpieza ?? []
  const tareasHoy = todas.filter((l) => l.fecha === hoyISO)
  const pendientes = todas.filter(
    (l) => l.fecha !== hoyISO && l.puede_firmar && !l.firmada_at,
  )

  if (tareasHoy.length === 0 && pendientes.length === 0) return null

  async function firmar(id: number, nombre: string) {
    const ok1 = window.confirm(
      `Confirmas que ya hiciste la tarea "${nombre}"?`,
    )
    if (!ok1) return
    const ok2 = window.confirm(
      'Confirmacion final: esta firma queda registrada con tu usuario y la hora actual. Realmente hiciste la tarea?',
    )
    if (!ok2) return
    setError(null)
    setProcesando(true)
    try {
      await api.firmarLimpieza(id)
      await onRefresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setProcesando(false)
    }
  }

  async function desfirmar(id: number, nombre: string) {
    const ok = window.confirm(`Deshacer la firma de "${nombre}"?`)
    if (!ok) return
    setError(null)
    setProcesando(true)
    try {
      await api.desfirmarLimpieza(id)
      await onRefresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setProcesando(false)
    }
  }

  function renderFila(
    t: { id: number; fecha: string; tipo_tarea_nombre: string; tipo_tarea_color: string; firmada_at: string | null },
    esDeHoy: boolean,
  ) {
    const firmada = t.firmada_at !== null
    return (
      <li
        key={t.id}
        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-xl p-3 ${
          esDeHoy ? 'border-slate-200' : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-sm font-bold text-white px-2 py-1 rounded shrink-0"
            style={{ backgroundColor: t.tipo_tarea_color }}
          >
            {t.tipo_tarea_nombre}
          </span>
          {!esDeHoy && (
            <span className="text-xs text-amber-800 shrink-0">
              {new Date(t.fecha + 'T12:00:00').toLocaleDateString('es-AR')}
            </span>
          )}
          {firmada && t.firmada_at && (
            <span className="text-xs text-emerald-700 truncate">
              Hecha a las{' '}
              {new Date(t.firmada_at).toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        {firmada ? (
          <button
            onClick={() => desfirmar(t.id, t.tipo_tarea_nombre)}
            disabled={procesando}
            className="rounded-lg bg-slate-100 text-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-200 disabled:opacity-50 shrink-0"
          >
            Deshacer
          </button>
        ) : (
          <button
            onClick={() => firmar(t.id, t.tipo_tarea_nombre)}
            disabled={procesando}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 shrink-0"
          >
            {procesando ? 'Procesando...' : 'Firmar'}
          </button>
        )}
      </li>
    )
  }

  return (
    <section className="bg-white rounded-2xl border-2 border-slate-900 p-4 sm:p-6 space-y-3">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">
          Tareas de limpieza
        </h2>
        <p className="text-sm text-slate-500">
          Marca cada tarea cuando la termines.
        </p>
      </header>

      {tareasHoy.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wide text-slate-400">
            Hoy
          </h3>
          <ul className="space-y-2">
            {tareasHoy.map((t) => renderFila(t, true))}
          </ul>
        </div>
      )}

      {pendientes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wide text-amber-700">
            Pendientes de firma ({pendientes.length})
          </h3>
          <ul className="space-y-2">
            {pendientes.map((t) => renderFila(t, false))}
          </ul>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </section>
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

function ListaTurnos({
  data,
  onRefresh,
}: {
  data: DashboardEmpleado
  onRefresh: () => Promise<void> | void
}) {
  const [procesando, setProcesando] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const turnos = data.turnos
  if (turnos.length === 0) {
    return (
      <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-6 text-center">
        No hay turnos cargados este mes.
      </p>
    )
  }

  const limpiezaPorFecha = new Map<string, LimpiezaEmpleado>(
    (data.limpieza ?? []).map((l) => [l.fecha, l]),
  )

  async function firmar(id: number, nombre: string) {
    const ok1 = window.confirm(
      `Confirmas que ya hiciste la tarea "${nombre}"?`,
    )
    if (!ok1) return
    const ok2 = window.confirm(
      'Confirmacion final: esta firma queda registrada con tu usuario y la hora actual. Realmente hiciste la tarea?',
    )
    if (!ok2) return
    setError(null)
    setProcesando(id)
    try {
      await api.firmarLimpieza(id)
      await onRefresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setProcesando(null)
    }
  }

  async function desfirmar(id: number, nombre: string) {
    const ok = window.confirm(`Deshacer la firma de "${nombre}"?`)
    if (!ok) return
    setError(null)
    setProcesando(id)
    try {
      await api.desfirmarLimpieza(id)
      await onRefresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setProcesando(null)
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {turnos.map((t) => {
          const limpieza = limpiezaPorFecha.get(t.fecha)
          const firmada = limpieza?.firmada_at != null
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
                <span className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="text-xs px-2 py-1 rounded-full text-white font-semibold whitespace-nowrap"
                    style={{ backgroundColor: limpieza.tipo_tarea_color }}
                  >
                    {limpieza.tipo_tarea_nombre}
                  </span>
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${
                      firmada ? 'bg-green-600' : 'bg-red-600'
                    }`}
                    title={firmada ? 'Firmada' : 'Sin firmar'}
                  />
                </span>
              )}
              {limpieza && !firmada && limpieza.puede_firmar && (
                <button
                  onClick={() =>
                    firmar(limpieza.id, limpieza.tipo_tarea_nombre)
                  }
                  disabled={procesando === limpieza.id}
                  className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 shrink-0"
                >
                  {procesando === limpieza.id ? 'Firmando...' : 'Firmar'}
                </button>
              )}
              {limpieza && firmada && limpieza.puede_firmar && (
                <button
                  onClick={() =>
                    desfirmar(limpieza.id, limpieza.tipo_tarea_nombre)
                  }
                  disabled={procesando === limpieza.id}
                  className="text-xs text-slate-500 hover:underline disabled:opacity-50 shrink-0"
                >
                  Deshacer
                </button>
              )}
              {t.horas_extra > 0 && (
                <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 whitespace-nowrap shrink-0">
                  +{t.horas_extra} HE
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
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
