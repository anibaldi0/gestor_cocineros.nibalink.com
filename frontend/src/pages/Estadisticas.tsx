import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { formatDNI } from '../lib/format'
import type {
  StatsAgregadasMes,
  StatsAnio,
  StatsEmpleadoMes,
  StatsHistorico,
  StatsMes,
} from '../lib/types'
import { useAuth } from '../lib/use-auth'
import RankingChart, {
  type MetricaRanking,
  etiquetaMetrica,
} from '../components/RankingChart'

type Vista = 'mensual' | 'anual' | 'historico'

export default function Estadisticas() {
  const { user } = useAuth()
  const esSuper = user?.roles.includes('SUPERADMIN') ?? false
  const hoy = new Date()

  const [vista, setVista] = useState<Vista>('mensual')
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)

  const [metrica, setMetrica] = useState<MetricaRanking>('horas_totales')
  const [statsMes, setStatsMes] = useState<StatsMes | null>(null)
  const [statsAnio, setStatsAnio] = useState<StatsAnio | null>(null)
  const [historico, setHistorico] = useState<StatsHistorico | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      if (vista === 'mensual') {
        setStatsMes(await api.statsMes(anio, mes))
      } else if (vista === 'anual') {
        setStatsAnio(await api.statsAnio(anio))
      } else {
        setHistorico(await api.statsHistorico())
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, anio, mes])

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

  function exportarCsv() {
    const token = localStorage.getItem('cocina_token')
    const url =
      vista === 'anual'
        ? api.statsAnioCsvUrl(anio)
        : api.statsMesCsvUrl(anio, mes)
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.blob())
      .then((b) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download =
          vista === 'anual'
            ? `estadisticas_${anio}.csv`
            : `estadisticas_${anio}_${String(mes).padStart(2, '0')}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .catch(() => alert('Error al descargar CSV'))
  }

  const mostrarBotonExportar =
    vista === 'mensual' || vista === 'anual'

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Estadisticas
          </h1>
          <p className="text-sm text-slate-500">
            {vista === 'mensual' && 'Resumen del mes.'}
            {vista === 'anual' && 'Acumulado de los 12 meses del anio.'}
            {vista === 'historico' && 'Resumen por anio.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mostrarBotonExportar && (
            <button
              onClick={exportarCsv}
              className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-medium"
            >
              Exportar CSV
            </button>
          )}
          {vista === 'mensual' && (
            <>
              <button
                onClick={mesAnterior}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200"
              >
                {'<'}
              </button>
              <span className="text-sm font-medium min-w-[100px] text-center">
                {nombreMes(mes)} {anio}
              </span>
              <button
                onClick={mesSiguiente}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200"
              >
                {'>'}
              </button>
            </>
          )}
          {vista === 'anual' && (
            <>
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
            </>
          )}
        </div>
      </div>

      <nav className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1">
        {(['mensual', 'anual', 'historico'] as const).map((v) => {
          if (v === 'historico' && !esSuper) return null
          return (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                vista === v
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {v}
            </button>
          )
        })}
      </nav>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando...</p>
      ) : (
        <>
          {vista === 'mensual' && statsMes && (
            <VistaMensual
              data={statsMes}
              metrica={metrica}
              setMetrica={setMetrica}
            />
          )}
          {vista === 'anual' && statsAnio && (
            <VistaAnual
              data={statsAnio}
              metrica={metrica}
              setMetrica={setMetrica}
            />
          )}
          {vista === 'historico' && historico && (
            <VistaHistorico data={historico} />
          )}
        </>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------
// Vista mensual
// ----------------------------------------------------------------------
function VistaMensual({
  data,
  metrica,
  setMetrica,
}: {
  data: StatsMes
  metrica: MetricaRanking
  setMetrica: (m: MetricaRanking) => void
}) {
  const [orden, setOrden] = useState<
    'apellido' | 'horas' | 'he' | 'francos' | 'vacaciones'
  >('apellido')
  const empleados = ordenar(data.empleados, orden)

  return (
    <>
      <CardsAgregadas data={data.agregadas} />
      <SeccionRanking
        empleados={data.empleados}
        metrica={metrica}
        setMetrica={setMetrica}
      />
      <OrdenSelector orden={orden} setOrden={setOrden} />
      <TablaEmpleados empleados={empleados} />
    </>
  )
}

// ----------------------------------------------------------------------
// Vista anual
// ----------------------------------------------------------------------
function VistaAnual({
  data,
  metrica,
  setMetrica,
}: {
  data: StatsAnio
  metrica: MetricaRanking
  setMetrica: (m: MetricaRanking) => void
}) {
  const [orden, setOrden] = useState<
    'apellido' | 'horas' | 'he' | 'francos' | 'vacaciones'
  >('apellido')
  const empleados = ordenar(data.empleados, orden)

  return (
    <>
      <CardsAgregadas data={data.agregadas} />
      <TarjetasPorMes data={data} />
      <SeccionRanking
        empleados={data.empleados}
        metrica={metrica}
        setMetrica={setMetrica}
      />
      <OrdenSelector orden={orden} setOrden={setOrden} />
      <TablaEmpleados empleados={empleados} />
    </>
  )
}

// ----------------------------------------------------------------------
// Vista historico
// ----------------------------------------------------------------------
function VistaHistorico({ data }: { data: StatsHistorico }) {
  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 px-3 py-3">
        <div className="text-xs uppercase tracking-wide text-slate-400">
          Empleados historicos (unicos)
        </div>
        <div className="text-lg font-semibold text-slate-900">
          {data.total_empleados_distintos}
        </div>
      </div>

      {data.anios.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-6 text-center">
          Todavia no hay datos historicos.
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Anio</th>
                <th className="text-right px-4 py-2 font-medium">Empleados</th>
                <th className="text-right px-4 py-2 font-medium">Horas</th>
                <th className="text-right px-4 py-2 font-medium">HE</th>
                <th className="text-right px-4 py-2 font-medium">Rojos</th>
                <th className="text-right px-4 py-2 font-medium">
                  Amarillos
                </th>
              </tr>
            </thead>
            <tbody>
              {data.anios.map((a) => (
                <tr key={a.anio} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{a.anio}</td>
                  <td className="px-4 py-2 text-right">
                    {a.agregadas.empleados_activos}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {a.agregadas.horas_totales_plantel.toFixed(1)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {a.agregadas.horas_extra_totales.toFixed(1)}
                  </td>
                  <td className="px-4 py-2 text-right text-red-700">
                    {a.agregadas.dias_con_alerta_roja}
                  </td>
                  <td className="px-4 py-2 text-right text-amber-700">
                    {a.agregadas.dias_con_alerta_amarilla}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ----------------------------------------------------------------------
// Componentes compartidos
// ----------------------------------------------------------------------
function ordenar(
  empleados: StatsEmpleadoMes[],
  orden: 'apellido' | 'horas' | 'he' | 'francos' | 'vacaciones',
): StatsEmpleadoMes[] {
  return [...empleados].sort((a, b) => {
    if (orden === 'apellido') return a.apellido.localeCompare(b.apellido)
    if (orden === 'horas') return b.horas_totales - a.horas_totales
    if (orden === 'he') return b.horas_extra - a.horas_extra
    if (orden === 'francos') return b.dias_franco - a.dias_franco
    if (orden === 'vacaciones')
      return b.dias_vacaciones - a.dias_vacaciones
    return 0
  })
}

function OrdenSelector({
  orden,
  setOrden,
}: {
  orden: string
  setOrden: (o: 'apellido' | 'horas' | 'he' | 'francos' | 'vacaciones') => void
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Ordenar por:</span>
      <select
        value={orden}
        onChange={(e) => setOrden(e.target.value as never)}
        className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
      >
        <option value="apellido">Apellido</option>
        <option value="horas">Horas totales</option>
        <option value="he">Horas extra</option>
        <option value="francos">Francos</option>
        <option value="vacaciones">Vacaciones</option>
      </select>
    </div>
  )
}

function CardsAgregadas({ data }: { data: StatsAgregadasMes }) {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      <Card label="Empleados" value={data.empleados_activos} />
      <Card
        label="Horas plantel"
        value={data.horas_totales_plantel.toFixed(1)}
      />
      <Card
        label="HE totales"
        value={data.horas_extra_totales.toFixed(1)}
      />
      <Card label="Dias" value={data.dias_totales_mes} />
      <Card
        label="Dias rojos"
        value={data.dias_con_alerta_roja}
        color="rojo"
      />
      <Card
        label="Dias amarillos"
        value={data.dias_con_alerta_amarilla}
        color="amarillo"
      />
    </section>
  )
}

const METRICAS: MetricaRanking[] = [
  'horas_totales',
  'horas_extra',
  'dias_trabajados',
  'dias_franco',
  'dias_vacaciones',
  'dias_licencia',
]

function SeccionRanking({
  empleados,
  metrica,
  setMetrica,
}: {
  empleados: StatsEmpleadoMes[]
  metrica: MetricaRanking
  setMetrica: (m: MetricaRanking) => void
}) {
  const [verTodos, setVerTodos] = useState(false)

  return (
    <section className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-700">
          Ranking por empleado
        </h3>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Metrica:</span>
          <select
            value={metrica}
            onChange={(e) => setMetrica(e.target.value as MetricaRanking)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            {METRICAS.map((m) => (
              <option key={m} value={m}>
                {etiquetaMetrica[m]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <RankingChart
        empleados={empleados}
        metrica={metrica}
        max={verTodos ? 0 : 10}
      />

      <div className="text-center">
        <button
          onClick={() => setVerTodos((v) => !v)}
          className="text-xs text-slate-500 hover:text-slate-800 underline"
        >
          {verTodos ? 'Ver top 10' : 'Ver todos'}
        </button>
      </div>
    </section>
  )
}

function TarjetasPorMes({ data }: { data: StatsAnio }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-3">
      <h3 className="text-sm font-medium text-slate-700 mb-2">
        Evolucion mensual
      </h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {data.por_mes.map((m) => (
          <div
            key={m.mes}
            className="bg-slate-50 rounded-lg px-2 py-2 text-center"
          >
            <div className="text-xs text-slate-400 uppercase">
              {nombreMes(m.mes).slice(0, 3)}
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {m.agregadas.horas_totales_plantel.toFixed(0)}h
            </div>
            <div className="text-xs flex justify-center gap-1 mt-0.5">
              {m.agregadas.dias_con_alerta_roja > 0 && (
                <span className="text-red-600">
                  {m.agregadas.dias_con_alerta_roja}R
                </span>
              )}
              {m.agregadas.dias_con_alerta_amarilla > 0 && (
                <span className="text-amber-600">
                  {m.agregadas.dias_con_alerta_amarilla}A
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TablaEmpleados({ empleados }: { empleados: StatsEmpleadoMes[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Mobile: cards */}
      <ul className="sm:hidden divide-y divide-slate-100">
        {empleados.map((e) => (
          <li key={e.empleado_id} className="px-4 py-3">
            <p className="font-medium">
              {e.apellido}, {e.nombre}
            </p>
            <p className="text-xs text-slate-500">DNI {formatDNI(e.dni)}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <Cell label="Dias trab." value={e.dias_trabajados} />
              <Cell label="Francos" value={e.dias_franco} />
              <Cell label="Vacaciones" value={e.dias_vacaciones} />
              <Cell label="Licencias" value={e.dias_licencia} />
              <Cell label="Horas" value={e.horas_trabajadas.toFixed(1)} />
              <Cell
                label="HE"
                value={e.horas_extra.toFixed(1)}
                highlight={e.horas_extra > 0}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: tabla */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Empleado</th>
              <th className="text-left px-4 py-2 font-medium">DNI</th>
              <th className="text-right px-4 py-2 font-medium">Trab.</th>
              <th className="text-right px-4 py-2 font-medium">Franco</th>
              <th className="text-right px-4 py-2 font-medium">Vacac.</th>
              <th className="text-right px-4 py-2 font-medium">Lic.</th>
              <th className="text-right px-4 py-2 font-medium">Aus.</th>
              <th className="text-right px-4 py-2 font-medium">Horas</th>
              <th className="text-right px-4 py-2 font-medium">HE</th>
              <th className="text-right px-4 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {empleados.map((e) => (
              <tr key={e.empleado_id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  {e.apellido}, {e.nombre}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {formatDNI(e.dni)}
                </td>
                <td className="px-4 py-2 text-right">{e.dias_trabajados}</td>
                <td className="px-4 py-2 text-right">{e.dias_franco}</td>
                <td className="px-4 py-2 text-right">
                  {e.dias_vacaciones}
                </td>
                <td className="px-4 py-2 text-right">{e.dias_licencia}</td>
                <td className="px-4 py-2 text-right">{e.dias_ausencia}</td>
                <td className="px-4 py-2 text-right">
                  {e.horas_trabajadas.toFixed(1)}
                </td>
                <td
                  className={`px-4 py-2 text-right ${
                    e.horas_extra > 0
                      ? 'font-medium text-red-700'
                      : 'text-slate-400'
                  }`}
                >
                  {e.horas_extra.toFixed(1)}
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {e.horas_totales.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function nombreMes(m: number): string {
  return (
    [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ][m - 1] ?? String(m)
  )
}

function Card({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color?: 'rojo' | 'amarillo'
}) {
  let clase = 'text-slate-900'
  if (color === 'rojo' && Number(value) > 0) clase = 'text-red-700'
  else if (color === 'amarillo' && Number(value) > 0) clase = 'text-amber-700'
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-3 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className={`text-lg font-semibold ${clase}`}>{value}</div>
    </div>
  )
}

function Cell({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span
        className={highlight ? 'font-medium text-red-700' : 'text-slate-800'}
      >
        {value}
      </span>
    </div>
  )
}
