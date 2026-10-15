import { useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'
import {
  colorCeldaVacia,
  colorEncabezadoDia,
  colorEstado,
  colorHorasExtra,
  etiquetaEstado,
} from '../lib/colores'
import type {
  AlertaDia,
  AsignacionLimpiezaGrilla,
  ContextoFranja,
  DiaGrilla,
  EstadoPeriodoGrilla,
  EstadoDia,
  EmpleadoGrilla,
  EstadoTurno,
  Franja,
  GrillaMes,
  TurnoGrilla,
  TipoTareaLimpieza,
} from '../lib/types'
import { useAuth } from '../lib/use-auth'
import ModalCF from '../components/ModalCF'

type EstadoVisual =
  | 'TRABAJO'
  | 'TRABAJO_HE'
  | 'FRANCO'
  | 'FRANCO_HE'
  | 'VACACIONES'
  | 'LICENCIA_MEDICA'
  | 'ART'
  | 'LICENCIA_ESPECIAL'
  | 'AUSENCIA_INJUSTIFICADA'

const ESTADOS_VISUALES: EstadoVisual[] = [
  'TRABAJO',
  'TRABAJO_HE',
  'FRANCO',
  'FRANCO_HE',
  'VACACIONES',
  'LICENCIA_MEDICA',
  'ART',
  'LICENCIA_ESPECIAL',
  'AUSENCIA_INJUSTIFICADA',
]

const nombreEstadoVisual: Record<EstadoVisual, string> = {
  TRABAJO: 'Trabajo',
  TRABAJO_HE: 'Trabajo + HE (al 50%)',
  FRANCO: 'Franco',
  FRANCO_HE: 'Franco + HE (al 100%)',
  VACACIONES: 'Vacaciones',
  LICENCIA_MEDICA: 'Licencia medica',
  ART: 'ART',
  LICENCIA_ESPECIAL: 'Licencia especial',
  AUSENCIA_INJUSTIFICADA: 'Ausencia injustificada',
}

function aEstadoVisual(
  estado: EstadoTurno,
  horasExtra: number,
): EstadoVisual {
  if (estado === 'TRABAJO' && horasExtra > 0) return 'TRABAJO_HE'
  if (estado === 'FRANCO' && horasExtra > 0) return 'FRANCO_HE'
  return estado as EstadoVisual
}

function aEstadoBase(v: EstadoVisual): {
  estado: EstadoTurno
  tieneHE: boolean
} {
  if (v === 'TRABAJO_HE') return { estado: 'TRABAJO', tieneHE: true }
  if (v === 'FRANCO_HE') return { estado: 'FRANCO', tieneHE: true }
  return { estado: v as EstadoTurno, tieneHE: false }
}

function iniciales(apellido: string, nombre: string): string {
  const a = apellido.trim()[0]?.toUpperCase() ?? ''
  const n = nombre.trim()[0]?.toUpperCase() ?? ''
  return `${a}${n}`
}

function nombreMes(m: number): string {
  return (
    [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ][m - 1] ?? String(m)
  )
}

function contextoDelDia(d: DiaGrilla): ContextoFranja {
  if (d.es_feriado) return 'FERIADO'
  if (d.tipo_dia_operativo === 'FINDE_FERIADO') return 'FINDE'
  return 'LABORAL'
}

interface Seleccion {
  empleado: EmpleadoGrilla
  fecha: string
  turno: TurnoGrilla | null
  contexto: ContextoFranja
  limpiezaAsignada: AsignacionLimpiezaGrilla | null
  limpiezaOtras: AsignacionLimpiezaGrilla[]
}

export default function Grilla() {
  const { user } = useAuth()
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)

  const [grilla, setGrilla] = useState<GrillaMes | null>(null)
  const [franjas, setFranjas] = useState<Franja[]>([])
  const [tiposLimpieza, setTiposLimpieza] = useState<TipoTareaLimpieza[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null)
  const [modalCF, setModalCF] = useState<Seleccion | null>(null)
  const [nombreCompacto, setNombreCompacto] = useState(false)
  const [panelAlertas, setPanelAlertas] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [confirmPublicar, setConfirmPublicar] = useState(false)
  const [rellenando, setRellenando] = useState(false)
  const [diaHover, setDiaHover] = useState<{
    fecha: string
    x: number
    y: number
  } | null>(null)
  const [diaModal, setDiaModal] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollPosRef = useRef<{ left: number; top: number } | null>(null)

  function onScrollGrilla(e: React.UIEvent<HTMLDivElement>) {
    const sl = e.currentTarget.scrollLeft
    if (!nombreCompacto && sl > 40) setNombreCompacto(true)
    else if (nombreCompacto && sl < 20) setNombreCompacto(false)
  }

  const esGestor =
    (user?.roles.includes('EDITOR') ?? false) ||
    (user?.roles.includes('SUPERADMIN') ?? false)
  const puedeEditar = esGestor

  async function cargar() {
    // Guardar la posicion actual del scroll antes de desmontar la tabla.
    if (scrollRef.current) {
      scrollPosRef.current = {
        left: scrollRef.current.scrollLeft,
        top: scrollRef.current.scrollTop,
      }
    }
    setLoading(true)
    setError(null)
    try {
      const g = await api.grillaMes(anio, mes)
      setGrilla(g)
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

  // Restaurar la posicion del scroll despues de cada carga.
  useEffect(() => {
    if (loading || !grilla) return
    if (!scrollRef.current || !scrollPosRef.current) return
    scrollRef.current.scrollLeft = scrollPosRef.current.left
    scrollRef.current.scrollTop = scrollPosRef.current.top
    scrollPosRef.current = null
  }, [loading, grilla])

  useEffect(() => {
    void (async () => {
      try {
        setFranjas(await api.franjas())
      } catch {
        setFranjas([])
      }
      try {
        setTiposLimpieza(await api.limpiezaTipos())
      } catch {
        setTiposLimpieza([])
      }
    })()
  }, [])

  const turnoPorCelda = useMemo(() => {
    const map = new Map<string, TurnoGrilla>()
    if (!grilla) return map
    for (const t of grilla.turnos) {
      map.set(`${t.empleado_id}|${t.fecha}`, t)
    }
    return map
  }, [grilla])

  const estadoPorDia = useMemo(() => {
    const map = new Map<string, EstadoDia>()
    if (!grilla) return map
    for (const e of grilla.estado_por_dia) {
      map.set(e.fecha, e)
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

  const alertasPorDia = useMemo(() => {
    const map = new Map<string, AlertaDia[]>()
    if (!grilla) return map
    for (const a of grilla.alertas) {
      const arr = map.get(a.fecha) ?? []
      arr.push(a)
      map.set(a.fecha, arr)
    }
    return map
  }, [grilla])

  async function rellenarHuecos() {
    const ok = window.confirm(
      `Rellenar huecos de ${nombreMes(mes)} ${anio}? Se van a crear turnos M (8hs) para todos los empleados activos en los dias L-V no feriados que esten vacios. No se toca lo ya cargado.`,
    )
    if (!ok) return
    setRellenando(true)
    try {
      const res = await api.rellenarHuecos(anio, mes)
      if (res.creados === 0) {
        alert('No hay huecos para rellenar. Todos los dias L-V ya tienen turnos.')
      } else {
        alert(
          `Se crearon ${res.creados} turnos en ${res.empleados} empleados x ${res.dias_habiles} dias habiles.`,
        )
      }
      await cargar()
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setRellenando(false)
    }
  }

  async function publicar() {
    setPublicando(true)
    try {
      await api.publicarGrilla(anio, mes)
      setConfirmPublicar(false)
      await cargar()
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setPublicando(false)
    }
  }

  async function reabrir() {
    const ok1 = window.confirm(
      `Reabrir la grilla de ${mes}/${anio}? Volvera a estado BORRADOR y se podra editar.`,
    )
    if (!ok1) return
    const ok2 = window.confirm(
      'Vas a reabrir un mes publicado. La accion queda registrada con tu usuario. Confirmar?',
    )
    if (!ok2) return
    setPublicando(true)
    try {
      await api.reabrirGrilla(anio, mes)
      await cargar()
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setPublicando(false)
    }
  }

  function pedirPublicar() {
    const ok1 = window.confirm(
      `Publicar la grilla de ${mes}/${anio}? Una vez publicado, el mes queda cerrado.`,
    )
    if (!ok1) return
    const alertas = grilla?.alertas.length ?? 0
    if (alertas > 0) {
      const ok2 = window.confirm(
        `Esta grilla tiene ${alertas} alertas de cobertura sin resolver. Publicar de todos modos?`,
      )
      if (!ok2) return
    }
    const ok3 = window.confirm(
      'Vas a publicar la grilla. Esta accion queda registrada con tu usuario y fecha. Confirmar?',
    )
    if (!ok3) return
    void publicar()
  }

  // Los empleados puros siempre ven el mes en curso.
  useEffect(() => {
    if (!esGestor) {
      const h = new Date()
      setAnio(h.getFullYear())
      setMes(h.getMonth() + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esGestor])

  function mesAnterior() {
    if (!esGestor) return
    if (mes === 1) {
      setMes(12)
      setAnio(anio - 1)
    } else {
      setMes(mes - 1)
    }
  }

  function mesSiguiente() {
    if (!esGestor) return
    if (mes === 12) {
      setMes(1)
      setAnio(anio + 1)
    } else {
      setMes(mes + 1)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Cargando grilla...</p>
  if (error)
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error}
      </p>
    )
  if (!grilla) return null

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Grilla mensual
          </h1>
          {esGestor && (
            <div className="flex items-center gap-2">
              {grilla.estado_periodo === 'BORRADOR' && (
                <button
                  onClick={rellenarHuecos}
                  disabled={rellenando}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200 disabled:opacity-50"
                  title="Rellena los dias L-V vacios con turno M de 8hs"
                >
                  {rellenando ? 'Rellenando...' : 'Rellenar huecos'}
                </button>
              )}
              {grilla.estado_periodo === 'BORRADOR' ? (
                <button
                  onClick={pedirPublicar}
                  disabled={publicando}
                  className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {publicando ? 'Publicando...' : 'Publicar'}
                </button>
              ) : (
                <button
                  onClick={reabrir}
                  disabled={publicando}
                  className="rounded-lg bg-amber-100 text-amber-800 px-3 py-2 text-sm font-medium hover:bg-amber-200 disabled:opacity-50"
                >
                  {publicando ? 'Reabriendo...' : 'Reabrir mes'}
                </button>
              )}
              <button
                onClick={() => setPanelAlertas((v) => !v)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  (grilla?.alertas.length ?? 0) > 0
                    ? 'bg-red-100 text-red-800 hover:bg-red-200'
                    : 'bg-slate-100 hover:bg-slate-200'
                }`}
                title="Alertas del mes"
              >
                Alertas ({grilla?.alertas.length ?? 0})
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          {esGestor && (
            <button
              onClick={mesAnterior}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200"
              aria-label="Mes anterior"
            >
              {'<'}
            </button>
          )}
          <span className="text-2xl font-semibold tracking-tight text-slate-800 text-center min-w-[180px]">
            {nombreMes(mes)} {anio}
          </span>
          {esGestor && (
            <button
              onClick={mesSiguiente}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200"
              aria-label="Mes siguiente"
            >
              {'>'}
            </button>
          )}
        </div>
      </div>

      {grilla.estado_periodo === 'PUBLICADO' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>
            <strong>Grilla publicada</strong>.
            {esGestor
              ? ' Esta es la version oficial del mes. Cualquier cambio requiere reabrir el mes.'
              : ' Esta es la version oficial del mes en curso.'}
          </span>
          {esGestor && (
            <a
              href={`/grilla/imprimir?anio=${anio}&mes=${mes}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-emerald-700 text-white px-3 py-1.5 text-xs font-medium whitespace-nowrap"
            >
              Ver version imprimible
            </a>
          )}
        </div>
      )}

      {esGestor && grilla.estado_periodo === 'BORRADOR' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
          <strong>Borrador</strong>. Esta grilla se puede editar. Publica el mes
          cuando este cerrada para que los empleados la vean como oficial.
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={onScrollGrilla}
        className="overflow-auto border border-slate-200 rounded-xl bg-white max-h-[75vh]"
      >
        <table className="min-w-full text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-white">
            <tr>
              <th
                className={`sticky left-0 z-30 bg-white border-r border-b border-slate-200 text-left font-medium ${
                  nombreCompacto
                    ? 'w-[56px] min-w-[56px] px-1'
                    : 'w-[180px] min-w-[180px] px-3'
                } py-2`}
              >
                {nombreCompacto ? 'Em.' : 'Empleado'}
              </th>
              {grilla.dias.map((d) => (
                <th
                  key={d.fecha}
                  className={`border-r border-b border-slate-200 px-1 py-1 text-center font-medium align-middle cursor-pointer ${colorEncabezadoDia(d)}`}
                  style={{ minWidth: 44 }}
                  onMouseEnter={
                    esGestor
                      ? (e) => {
                          const rect =
                            e.currentTarget.getBoundingClientRect()
                          setDiaHover({
                            fecha: d.fecha,
                            x: rect.left + rect.width / 2,
                            y: rect.bottom,
                          })
                        }
                      : undefined
                  }
                  onMouseLeave={
                    esGestor ? () => setDiaHover(null) : undefined
                  }
                  onClick={
                    esGestor
                      ? () => {
                          setDiaHover(null)
                          setDiaModal(d.fecha)
                        }
                      : undefined
                  }
                >
                  <div className="text-[10px] uppercase">
                    {d.nombre_dia.slice(0, 3)}
                  </div>
                  <div className="text-sm font-semibold">
                    {Number(d.fecha.slice(8, 10))}
                  </div>
                  {esGestor &&
                    (() => {
                      const est = estadoPorDia.get(d.fecha)
                      if (!est || est.estado === 'OK') return null
                      const color =
                        est.estado === 'ROJO'
                          ? 'bg-red-500'
                          : 'bg-amber-400'
                      return (
                        <div
                          className={`w-2 h-2 rounded-full mx-auto mt-0.5 ${color}`}
                        />
                      )
                    })()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grilla.empleados.map((emp) => (
              <tr key={emp.id} className="border-b border-slate-100">
                <th
                  className={`sticky left-0 z-10 bg-white border-r border-slate-200 text-left font-medium ${
                    nombreCompacto
                      ? 'w-[56px] min-w-[56px] px-1'
                      : 'w-[180px] min-w-[180px] px-3'
                  } py-2`}
                  title={`${emp.apellido}, ${emp.nombre}`}
                >
                  {nombreCompacto ? (
                    <div className="text-center font-semibold text-slate-700">
                      {iniciales(emp.apellido, emp.nombre)}
                    </div>
                  ) : (
                    <div className="truncate max-w-[160px]">
                      {emp.apellido}, {emp.nombre}
                    </div>
                  )}
                </th>
                {grilla.dias.map((d) => {
                  const t = turnoPorCelda.get(`${emp.id}|${d.fecha}`)
                  const estado = t?.estado ?? null
                  const etiqueta = estado ? etiquetaEstado[estado] : ''
                  const he = t?.horas_extra ?? 0
                  // Prioridad de fondo:
                  //   1. horas extra > 0 -> rojo
                  //   2. estado no-TRABAJO -> color del estado
                  //   3. vacio o TRABAJO -> color del dia
                  const fondo =
                    he > 0
                      ? colorHorasExtra
                      : estado && estado !== 'TRABAJO'
                        ? colorEstado[estado]
                        : colorCeldaVacia(d)
                  const esCF = t?.es_franco_protegido ?? false
                  const limpieza = limpiezaPorCelda.get(
                    `${emp.id}|${d.fecha}`,
                  )
                  const tooltipBase = t
                    ? `${estado}${esCF ? ' (CF)' : ''} ${t.horas ? `- ${t.horas}hs` : ''}${t.nota ? ` - ${t.nota}` : ''}`
                    : ''
                  const tooltipLimpieza = limpieza
                    ? `Limpia: ${limpieza.tipo_tarea_nombre}`
                    : ''
                  const tooltip = [tooltipBase, tooltipLimpieza]
                    .filter(Boolean)
                    .join(' | ')
                  return (
                    <td
                      key={d.fecha}
                      onClick={() => {
                        if (!puedeEditar) return
                        const otrasLimpiezas = (grilla.limpieza ?? []).filter(
                          (l) =>
                            l.fecha === d.fecha && l.empleado_id !== emp.id,
                        )
                        setSeleccion({
                          empleado: emp,
                          fecha: d.fecha,
                          turno: t ?? null,
                          contexto: contextoDelDia(d),
                          limpiezaAsignada: limpieza ?? null,
                          limpiezaOtras: otrasLimpiezas,
                        })
                      }}
                      title={tooltip}
                      className={`border-r border-slate-100 text-center align-middle relative ${
                        puedeEditar
                          ? 'cursor-pointer hover:ring-2 hover:ring-slate-900/20'
                          : ''
                      } ${fondo}`}
                      style={
                        limpieza
                          ? {
                              boxShadow: `inset 0 0 0 3px ${limpieza.tipo_tarea_color}`,
                            }
                          : undefined
                      }
                    >
                      <div className="py-1 px-0.5 leading-tight">
                        {estado === 'TRABAJO' ? (
                          <>
                            <div className="text-sm font-semibold">
                              {t?.horas}
                              {he > 0 && (
                                <span className="text-red-600 ml-0.5">
                                  +{he}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px]">
                              {t?.codigo_corto ?? ''}
                            </div>
                          </>
                        ) : estado === 'FRANCO' && he > 0 ? (
                          <div className="text-sm font-semibold text-red-600">
                            +{he}
                          </div>
                        ) : estado ? (
                          <div className="text-xs font-semibold">
                            {esCF ? 'CF' : etiqueta}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-300">-</div>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {panelAlertas && grilla && (
        <PanelAlertas
          alertas={grilla.alertas}
          onCerrar={() => setPanelAlertas(false)}
        />
      )}

      {diaHover &&
        (() => {
          const dia = grilla?.dias.find((x) => x.fecha === diaHover.fecha)
          const alertas = alertasPorDia.get(diaHover.fecha) ?? []
          if (!dia) return null
          const eventos = dia.eventos.map((e) => e.nombre)
          const tieneContenido = eventos.length > 0 || alertas.length > 0
          if (!tieneContenido) return null
          return (
            <div
              className="fixed z-[60] pointer-events-none"
              style={{
                left: diaHover.x,
                top: diaHover.y + 6,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-lg space-y-1">
                <div className="font-semibold">{diaHover.fecha}</div>
                {eventos.length > 0 && (
                  <div className="text-amber-300">{eventos.join(', ')}</div>
                )}
                {alertas.length === 0 ? (
                  <div className="text-emerald-300">Sin alertas</div>
                ) : (
                  <ul className="space-y-0.5">
                    {alertas.slice(0, 4).map((a, i) => (
                      <li
                        key={i}
                        className={
                          a.nivel === 'ROJO'
                            ? 'text-red-300'
                            : 'text-amber-300'
                        }
                      >
                        {a.mensaje}
                      </li>
                    ))}
                    {alertas.length > 4 && (
                      <li className="text-slate-400">
                        + {alertas.length - 4} mas...
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          )
        })()}

      {diaModal && (
        <ModalAlertasDia
          fecha={diaModal}
          dia={grilla?.dias.find((x) => x.fecha === diaModal) ?? null}
          alertas={alertasPorDia.get(diaModal) ?? []}
          onCerrar={() => setDiaModal(null)}
        />
      )}

      {seleccion && (
        <EditorCelda
          seleccion={seleccion}
          franjas={franjas}
          tiposLimpieza={tiposLimpieza}
          onClose={() => setSeleccion(null)}
          onGuardado={async () => {
            setSeleccion(null)
            await cargar()
          }}
          onPedirCF={(notaExistente) => {
            setModalCF({ ...seleccion, turno: seleccion.turno })
            setSeleccion(null)
            void notaExistente
          }}
          onEliminar={async () => {
            if (!seleccion.turno) return
            const ok = window.confirm(
              seleccion.turno.es_franco_protegido
                ? `Este franco esta protegido. Nota: "${seleccion.turno.nota}". Borrar de todos modos?`
                : 'Borrar el turno de este dia?',
            )
            if (!ok) return
            try {
              await api.borrarTurno(seleccion.empleado.id, seleccion.fecha)
              setSeleccion(null)
              await cargar()
            } catch (e) {
              alert(e instanceof ApiError ? e.message : 'Error')
            }
          }}
        />
      )}

      {modalCF && (
        <ModalCF
          modo={modalCF.turno?.es_franco_protegido ? 'modificar' : 'crear'}
          notaInicial={modalCF.turno?.nota ?? null}
          empleadoNombre={`${modalCF.empleado.apellido}, ${modalCF.empleado.nombre}`}
          fechaISO={modalCF.fecha}
          onCancelar={() => setModalCF(null)}
          onConfirmar={async (nota) => {
            try {
              await api.upsertTurno({
                empleado_id: modalCF.empleado.id,
                fecha: modalCF.fecha,
                estado: 'FRANCO',
                franja_id: null,
                horas: 0,
                horas_extra: modalCF.turno?.horas_extra ?? 0,
                es_franco_protegido: true,
                nota,
              })
              setModalCF(null)
              await cargar()
            } catch (e) {
              alert(e instanceof ApiError ? e.message : 'Error')
            }
          }}
        />
      )}
    </div>
  )
}

interface EditorProps {
  seleccion: Seleccion
  franjas: Franja[]
  onClose: () => void
  onGuardado: () => Promise<void> | void
  onPedirCF: (notaExistente: string | null) => void
  onEliminar: () => Promise<void> | void
  tiposLimpieza: TipoTareaLimpieza[]
}

function EditorCelda({
  seleccion,
  franjas,
  onClose,
  onGuardado,
  onPedirCF,
  onEliminar,
  tiposLimpieza,
}: EditorProps) {
  const { empleado, fecha, turno } = seleccion
  const estadoInicial = aEstadoVisual(
    turno?.estado ?? 'TRABAJO',
    turno?.horas_extra ?? 0,
  )
  const [estadoVisual, setEstadoVisual] = useState<EstadoVisual>(estadoInicial)
  const [franjaId, setFranjaId] = useState<number | null>(
    turno?.franja_id ?? null,
  )
  const [horas, setHoras] = useState<number>(turno?.horas ?? 8)
  const [horasExtra, setHorasExtra] = useState<number>(turno?.horas_extra ?? 0)
  const [tareaLimpiezaId, setTareaLimpiezaId] = useState<number | null>(
    seleccion.limpiezaAsignada?.tipo_tarea_id ?? null,
  )
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const base = aEstadoBase(estadoVisual)
  const estadoBase = base.estado
  const tieneHE = base.tieneHE
  const esTrabajo = estadoBase === 'TRABAJO'
  const esFranco = estadoBase === 'FRANCO'

  function onCambioEstadoVisual(v: EstadoVisual) {
    setEstadoVisual(v)
    const b = aEstadoBase(v)
    if (b.tieneHE) {
      if (horasExtra === 0) setHorasExtra(1)
    } else {
      setHorasExtra(0)
    }
  }

  // Solo se permite asignar limpieza en estados que implican presencia.
  const permiteLimpieza =
    estadoVisual === 'TRABAJO' ||
    estadoVisual === 'TRABAJO_HE' ||
    estadoVisual === 'FRANCO_HE'

  // Tareas ya tomadas por OTROS empleados ese dia.
  const tareasTomadasPorOtros = new Set(
    seleccion.limpiezaOtras.map((l) => l.tipo_tarea_id),
  )

  async function guardar() {
    setErr(null)
    setGuardando(true)
    try {
      await api.upsertTurno({
        empleado_id: empleado.id,
        fecha,
        estado: estadoBase,
        franja_id: esTrabajo ? franjaId : null,
        horas: esTrabajo ? horas : 0,
        horas_extra: tieneHE ? horasExtra : 0,
        es_franco_protegido: esFranco && (turno?.es_franco_protegido ?? false),
        nota: esFranco ? (turno?.nota ?? null) : null,
      })

      // Sincronizar limpieza.
      const teniaLimpieza = seleccion.limpiezaAsignada
      const quiereLimpieza =
        permiteLimpieza && tareaLimpiezaId !== null

      if (quiereLimpieza) {
        if (teniaLimpieza) {
          // Cambio de tarea o mismo tipo.
          if (teniaLimpieza.tipo_tarea_id !== tareaLimpiezaId) {
            await api.eliminarAsignacionLimpieza(teniaLimpieza.id)
            await api.crearAsignacionLimpieza({
              empleado_id: empleado.id,
              fecha,
              tipo_tarea_id: tareaLimpiezaId,
            })
          }
          // Mismo tipo: no hay nada que hacer.
        } else {
          await api.crearAsignacionLimpieza({
            empleado_id: empleado.id,
            fecha,
            tipo_tarea_id: tareaLimpiezaId,
          })
        }
      } else if (teniaLimpieza) {
        // El editor quito la limpieza (o el estado ya no permite).
        await api.eliminarAsignacionLimpieza(teniaLimpieza.id)
      }

      await onGuardado()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <header>
          <h2 className="text-lg font-semibold">
            {empleado.apellido}, {empleado.nombre}
          </h2>
          <p className="text-sm text-slate-500">{fecha}</p>
        </header>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Estado</span>
          <select
            value={estadoVisual}
            onChange={(e) =>
              onCambioEstadoVisual(e.target.value as EstadoVisual)
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          >
            {ESTADOS_VISUALES.map((s) => (
              <option key={s} value={s}>
                {nombreEstadoVisual[s]}
              </option>
            ))}
          </select>
        </label>

        {esTrabajo && (
          <>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Franja ({seleccion.contexto})
              </span>
              <select
                value={franjaId ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null
                  setFranjaId(id)
                  const f = franjas.find((x) => x.id === id)
                  if (f) setHoras(f.horas)
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              >
                <option value="">-- Elegir franja --</option>
                {franjas
                  .filter((f) => f.contexto === seleccion.contexto)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.codigo_corto ? `[${f.codigo_corto}] ` : ''}
                      {f.nombre} ({f.hora_inicio}-{f.hora_fin})
                    </option>
                  ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Horas (auto por franja)
              </span>
              <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={horas}
                onChange={(e) => setHoras(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
              <span className="text-xs text-slate-400">
                Se completa al elegir la franja. Podes ajustarla si hace falta.
              </span>
            </label>
          </>
        )}

        {tieneHE && (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Horas extra
            </span>
            <input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={horasExtra}
              onChange={(e) => setHorasExtra(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
            <span className="text-xs text-slate-400">
              {estadoVisual === 'TRABAJO_HE'
                ? 'Se pagan al 50% (despues del turno).'
                : 'Se pagan al 100% (franco trabajado).'}
            </span>
          </label>
        )}

        {permiteLimpieza && (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Tarea de limpieza
            </span>
            <select
              value={tareaLimpiezaId ?? ''}
              onChange={(e) =>
                setTareaLimpiezaId(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            >
              <option value="">Sin limpieza</option>
              {tiposLimpieza.map((t) => {
                const tomada = tareasTomadasPorOtros.has(t.id)
                return (
                  <option key={t.id} value={t.id} disabled={tomada}>
                    {t.nombre}
                    {tomada ? ' (ya asignada)' : ''}
                  </option>
                )
              })}
            </select>
            {tareaLimpiezaId && (
              <span className="text-xs text-slate-400">
                Se guardara al empleado como responsable de esta tarea ese dia.
              </span>
            )}
          </label>
        )}

        {esFranco && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            {turno?.es_franco_protegido ? (
              <>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Franco protegido (CF)
                </p>
                <p className="text-sm text-slate-700">
                  {turno.nota || '(sin nota)'}
                </p>
                <button
                  onClick={() => onPedirCF(turno.nota)}
                  className="text-sm text-amber-700 underline"
                >
                  Modificar nota del CF
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Este franco no esta protegido.
                </p>
                <button
                  onClick={() => onPedirCF(null)}
                  className="rounded-lg bg-amber-600 text-white px-3 py-2 text-sm font-medium"
                >
                  Marcar como protegido
                </button>
              </>
            )}
          </div>
        )}

        {err && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {err}
          </p>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={guardar}
              disabled={guardando}
              className="w-full sm:w-auto rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={onClose}
              className="w-full sm:w-auto rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
            >
              Cancelar
            </button>
          </div>
          {turno && (
            <button
              onClick={onEliminar}
              className="text-sm text-red-600 hover:underline self-start"
            >
              Borrar turno del dia
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


function PanelAlertas({
  alertas,
  onCerrar,
}: {
  alertas: AlertaDia[]
  onCerrar: () => void
}) {
  // Cerrar con tecla Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/40 p-0 sm:p-4"
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Alertas del mes</h2>
            <p className="text-sm text-slate-500">
              {alertas.length} problema(s) detectado(s)
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            Cerrar
          </button>
        </header>

        {alertas.length === 0 ? (
          <p className="text-sm text-slate-500">
            Todo cubierto. No hay alertas.
          </p>
        ) : (
          <ul className="space-y-2">
            {alertas.map((a, i) => (
              <li
                key={`${a.fecha}-${a.franja_id}-${i}`}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  a.nivel === 'ROJO'
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="font-medium">{a.fecha}</div>
                <div className="text-xs">{a.mensaje}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}


function ModalAlertasDia({
  fecha,
  dia,
  alertas,
  onCerrar,
}: {
  fecha: string
  dia: DiaGrilla | null
  alertas: AlertaDia[]
  onCerrar: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrar])

  const eventos = dia?.eventos.map((e) => e.nombre) ?? []

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{fecha}</h2>
            {dia && (
              <p className="text-sm text-slate-500">
                {dia.nombre_dia}
                {eventos.length > 0 && ` - ${eventos.join(', ')}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            Cerrar
          </button>
        </header>

        {alertas.length === 0 ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            Sin alertas para este dia. Cobertura OK.
          </p>
        ) : (
          <ul className="space-y-2">
            {alertas.map((a, i) => (
              <li
                key={i}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  a.nivel === 'ROJO'
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="text-xs uppercase tracking-wide opacity-70">
                  {a.franja_nombre}
                </div>
                <div>{a.mensaje}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
