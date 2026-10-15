import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import {
  colorEncabezadoDia,
  colorTurnoDia,
  colorEstado,
  etiquetaEstado,
} from '../lib/colores'
import { formatDNI } from '../lib/format'
import type {
  AsignacionLimpiezaGrilla,
  GrillaMes,
  TurnoGrilla,
} from '../lib/types'

export default function GrillaImprimir() {
  const [params] = useSearchParams()
  const anio = Number(params.get('anio') ?? new Date().getFullYear())
  const mes = Number(params.get('mes') ?? new Date().getMonth() + 1)

  const [grilla, setGrilla] = useState<GrillaMes | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      setGrilla(await api.grillaMes(anio, mes))
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

  const turnoPorCelda = useMemo(() => {
    const map = new Map<string, TurnoGrilla>()
    if (!grilla) return map
    for (const t of grilla.turnos) {
      map.set(`${t.empleado_id}|${t.fecha}`, t)
    }
    return map
  }, [grilla])

  const limpiezaPorCelda = useMemo(() => {
    const map = new Map<string, AsignacionLimpiezaGrilla>()
    if (!grilla) return map
    for (const l of grilla.limpieza ?? []) {
      map.set(`${l.empleado_id}|${l.fecha}`, l)
    }
    return map
  }, [grilla])

  if (loading)
    return <p className="text-sm text-slate-500 p-4">Cargando...</p>
  if (error)
    return <p className="text-red-600 p-4">{error}</p>
  if (!grilla) return null

  // Configuracion de impresion A4 horizontal
  const estiloImpresion = `
    @page { size: A4 landscape; margin: 8mm; }
    @media print {
      body { background: white !important; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      th, td { padding: 2px 3px !important; font-size: 9px !important; }
    }
  `

  return (
    <div className="bg-white min-h-screen p-4">
      <style>{estiloImpresion}</style>

      <div className="no-print mb-3 flex items-center gap-2">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium"
        >
          Imprimir / Guardar PDF
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
        >
          Cerrar
        </button>
        <span className="text-xs text-slate-500 ml-2 no-print">
          Se imprime en A4 horizontal.
        </span>
      </div>

      <header className="mb-2">
        <h1 className="text-lg font-semibold">
          Grilla mensual - {mes}/{anio}
        </h1>
      </header>

      <div className="overflow-auto">
        <table className="border-collapse w-full">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white border border-slate-300 px-2 py-1 text-left text-xs font-medium min-w-[160px]">
                Empleado
              </th>
              {grilla.dias.map((d) => (
                <th
                  key={d.fecha}
                  className={`border border-slate-300 text-center text-xs font-medium px-1 py-0.5 ${colorEncabezadoDia(d)}`}
                >
                  <div className="text-[8px] uppercase">
                    {d.nombre_dia.slice(0, 3)}
                  </div>
                  <div className="text-[11px] font-semibold">
                    {Number(d.fecha.slice(8, 10))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grilla.empleados.map((emp) => (
              <tr key={emp.id}>
                <th className="sticky left-0 z-10 bg-white border border-slate-300 px-2 py-0.5 text-left text-xs font-medium">
                  <div className="truncate max-w-[150px]">
                    {emp.apellido}, {emp.nombre}
                  </div>
                  <div className="text-[9px] text-slate-400 font-normal">
                    {formatDNI(
                      grilla.empleados.find((e) => e.id === emp.id)
                        ? ''
                        : '',
                    )}
                  </div>
                </th>
                {grilla.dias.map((d) => {
                  const t = turnoPorCelda.get(`${emp.id}|${d.fecha}`)
                  const estado = t?.estado ?? null
                  const etiqueta = estado ? etiquetaEstado[estado] : ''
                  const esCF = t?.es_franco_protegido ?? false
                  const he = t?.horas_extra ?? 0
                  const fondo =
                    estado && estado !== 'TRABAJO'
                      ? colorEstado[estado]
                      : ''
                  const limpieza = limpiezaPorCelda.get(
                    `${emp.id}|${d.fecha}`,
                  )
                  return (
                    <td
                      key={d.fecha}
                      className={`border border-slate-300 text-center text-[9px] leading-tight px-0.5 py-0.5 relative ${fondo}`}
                    >
                      {limpieza && (
                        <div
                          className="absolute top-0 right-0 text-[7px] font-bold text-white px-0.5"
                          style={{ backgroundColor: limpieza.tipo_tarea_color }}
                        >
                          {limpieza.tipo_tarea_abreviatura}
                        </div>
                      )}
                      {estado === 'TRABAJO' ? (
                        <>
                          <div className="font-semibold">{t?.horas}</div>
                          {t?.codigo_corto ? (
                            <div
                              className={`inline-block text-[8px] px-0.5 rounded ${colorTurnoDia[t.codigo_corto as 'M' | 'T'] ?? ''}`}
                            >
                              {t.codigo_corto}
                            </div>
                          ) : null}
                          {he > 0 ? (
                            <div className="text-[7px] text-red-700">
                              +{he}
                            </div>
                          ) : null}
                        </>
                      ) : estado ? (
                        <div className="font-semibold text-[10px]">
                          {esCF ? 'CF' : etiqueta}
                        </div>
                      ) : (
                        <span className="text-slate-200">-</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-3 text-[10px] text-slate-600 print:text-[9px]">
        <h2 className="font-semibold text-xs mb-1">Leyenda</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <strong>M / T</strong>: manana / tarde
          </span>
          <span>
            <strong>F</strong>: franco
          </span>
          <span>
            <strong>CF</strong>: franco protegido (pedido con antelacion)
          </span>
          <span>
            <strong>V</strong>: vacaciones
          </span>
          <span>
            <strong>LM</strong>: licencia medica
          </span>
          <span>
            <strong>ART</strong>: ART
          </span>
          <span>
            <strong>LE</strong>: licencia especial
          </span>
          <span>
            <strong>AI</strong>: ausencia injustificada
          </span>
          <span>
            <strong>+N</strong>: horas extra
          </span>
        </div>
      </section>
    </div>
  )
}
