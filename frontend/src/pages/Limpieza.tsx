import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { formatFecha } from '../lib/format'
import type {
  AsignacionLimpieza,
  Empleado,
  MesLimpieza,
  TipoTareaLimpieza,
} from '../lib/types'

export default function Limpieza() {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)

  const [data, setData] = useState<MesLimpieza | null>(null)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [celdaEditando, setCeldaEditando] = useState<{
    fecha: string
    tipoId: number
    asignacion: AsignacionLimpieza | null
  } | null>(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const [m, emps] = await Promise.all([
        api.limpiezaMes(anio, mes),
        api.get<Empleado[]>('/empleados?activo=true'),
      ])
      setData(m)
      setEmpleados(emps)
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

  // Generar los dias del mes.
  const dias = useMemo(() => {
    const total = new Date(anio, mes, 0).getDate()
    return Array.from({ length: total }, (_, i) => {
      const dia = i + 1
      const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      const nombre = new Date(anio, mes - 1, dia).toLocaleDateString(
        'es-AR',
        { weekday: 'short' },
      )
      return { dia, fecha, nombre }
    })
  }, [anio, mes])

  // Indice: (fecha, tipoId) -> asignacion
  const porCelda = useMemo(() => {
    const map = new Map<string, AsignacionLimpieza>()
    if (!data) return map
    for (const a of data.asignaciones) {
      map.set(`${a.fecha}|${a.tipo_tarea_id}`, a)
    }
    return map
  }, [data])

  if (loading) return <p className="text-sm text-slate-500">Cargando...</p>
  if (error)
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error}
      </p>
    )
  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Limpieza</h1>
          <p className="text-sm text-slate-500">
            Asignacion manual de camara, bano y sector por dia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/limpieza/imprimir?anio=${anio}&mes=${mes}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-medium"
          >
            Imprimir reportes
          </a>
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
        </div>
      </div>

      <div className="overflow-auto border border-slate-200 rounded-xl bg-white max-h-[75vh]">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="sticky left-0 z-20 bg-white border-r border-b border-slate-200 px-3 py-2 text-left font-medium min-w-[100px]">
                Fecha
              </th>
              {data.tipos.map((t) => (
                <th
                  key={t.id}
                  className="border-r border-b border-slate-200 px-2 py-2 text-center font-medium min-w-[140px]"
                  style={{ backgroundColor: `${t.color_hex}22` }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ background: t.color_hex }}
                    />
                    {t.nombre}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => (
              <tr key={d.fecha} className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white border-r border-slate-200 px-3 py-1.5 text-left">
                  <div className="font-medium text-slate-700">
                    {d.dia}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase">
                    {d.nombre}
                  </div>
                </td>
                {data.tipos.map((t) => {
                  const a = porCelda.get(`${d.fecha}|${t.id}`)
                  return (
                    <td
                      key={t.id}
                      className="border-r border-slate-100 px-1 py-1 text-center align-middle cursor-pointer hover:bg-slate-50"
                      onClick={() =>
                        setCeldaEditando({
                          fecha: d.fecha,
                          tipoId: t.id,
                          asignacion: a ?? null,
                        })
                      }
                      style={{
                        backgroundColor: a ? `${t.color_hex}22` : undefined,
                      }}
                    >
                      {a ? (
                        <div className="text-[11px] font-medium truncate">
                          {a.empleado_nombre}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-300">-</div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {celdaEditando && data && (
        <ModalCeldaLimpieza
          anio={anio}
          mes={mes}
          fecha={celdaEditando.fecha}
          tipo={data.tipos.find((t) => t.id === celdaEditando.tipoId)!}
          asignacion={celdaEditando.asignacion}
          empleados={empleados}
          onCerrar={() => setCeldaEditando(null)}
          onGuardado={async () => {
            setCeldaEditando(null)
            await cargar()
          }}
        />
      )}
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

function ModalCeldaLimpieza({
  fecha,
  tipo,
  asignacion,
  empleados,
  onCerrar,
  onGuardado,
}: {
  anio: number
  mes: number
  fecha: string
  tipo: TipoTareaLimpieza
  asignacion: AsignacionLimpieza | null
  empleados: Empleado[]
  onCerrar: () => void
  onGuardado: () => Promise<void> | void
}) {
  const [empleadoId, setEmpleadoId] = useState<number | ''>(
    asignacion?.empleado_id ?? '',
  )
  const [observacion, setObservacion] = useState(asignacion?.observacion ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    if (!empleadoId) {
      setError('Elegi un empleado')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (asignacion) {
        await api.actualizarAsignacionLimpieza(asignacion.id, {
          empleado_id: Number(empleadoId),
          observacion: observacion || null,
        })
      } else {
        await api.crearAsignacionLimpieza({
          empleado_id: Number(empleadoId),
          fecha,
          tipo_tarea_id: tipo.id,
          observacion: observacion || null,
        })
      }
      await onGuardado()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function eliminar() {
    if (!asignacion) return
    const ok = window.confirm(
      `Quitar la tarea de ${tipo.nombre} del ${fecha}?`,
    )
    if (!ok) return
    setLoading(true)
    try {
      await api.eliminarAsignacionLimpieza(asignacion.id)
      await onGuardado()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-900'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !loading && onCerrar()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {tipo.nombre}
            </h2>
            <p className="text-sm text-slate-500">
              {formatFecha(fecha)}
            </p>
          </div>
          <span
            className="inline-block w-4 h-4 rounded-full mt-1"
            style={{ background: tipo.color_hex }}
          />
        </header>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Empleado asignado
          </span>
          <select
            value={empleadoId}
            onChange={(e) =>
              setEmpleadoId(e.target.value ? Number(e.target.value) : '')
            }
            className={inputCls}
          >
            <option value="">-- Elegir --</option>
            {empleados.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.apellido}, {emp.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Observacion (opcional)
          </span>
          <input
            type="text"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            className={inputCls}
            maxLength={300}
          />
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={guardar}
            disabled={loading}
            className="w-full sm:w-auto rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium disabled:opacity-50"
          >
            {loading ? 'Guardando...' : asignacion ? 'Guardar cambios' : 'Asignar'}
          </button>
          <button
            onClick={onCerrar}
            disabled={loading}
            className="w-full sm:w-auto rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
          >
            Cancelar
          </button>
          {asignacion && (
            <button
              onClick={eliminar}
              disabled={loading}
              className="w-full sm:w-auto rounded-lg bg-red-50 text-red-700 px-4 py-3 text-base font-medium hover:bg-red-100 sm:ml-auto"
            >
              Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
