import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, type ErrorDetalle } from '../lib/api'
import { formatFecha } from '../lib/format'
import FechaInput from '../components/FechaInput'
import ModalImpacto from '../components/ModalImpacto'
import type { DetalleVacaciones, ModoConteo, NovedadVacaciones } from '../lib/types'

export default function VacacionesDetalle() {
  const { anio: anioStr, empleadoId: empIdStr } = useParams<{
    anio: string
    empleadoId: string
  }>()
  const navigate = useNavigate()
  const anio = Number(anioStr)
  const empleadoId = Number(empIdStr)

  const [detalle, setDetalle] = useState<DetalleVacaciones | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accion, setAccion] = useState(false)

  // Modal de carga de saldo inicial
  const [modalSaldo, setModalSaldo] = useState(false)

  // Modal de carga de periodo
  const [modalPeriodo, setModalPeriodo] = useState(false)
  // Novedad en edicion (null = crear)
  const [editando, setEditando] = useState<number | null>(null)

  // Modal de impacto
  const [impactoParams, setImpactoParams] = useState<{
    desde: string
    hasta: string
  } | null>(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      setDetalle(await api.detalleVacaciones(anio, empleadoId))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, empleadoId])

  async function eliminarPeriodo(novedadId: number) {
    const ok = window.confirm(
      'Cancelar este periodo? Se eliminaran los turnos de vacaciones generados.',
    )
    if (!ok) return
    setAccion(true)
    try {
      await api.eliminarNovedadVacaciones(novedadId)
      await cargar()
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setAccion(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Cargando...</p>
  if (error)
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error}
      </p>
    )
  if (!detalle) return null

  const { empleado, anual, novedades } = detalle

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button
        onClick={() => navigate(`/vacaciones?anio=${anio}`)}
        className="text-sm text-slate-500 hover:underline"
      >
        {'<-'} Volver a vacaciones
      </button>

      <header className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {empleado.apellido}, {empleado.nombre}
          </h1>
          <p className="text-sm text-slate-500">
            Año vacacional {anio} - DNI {empleado.dni}
          </p>
        </div>

        {anual ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            <StatCard
              label="Total"
              value={String(anual.dias_totales + anual.dias_arrastrados)}
            />
            <StatCard label="Tomados" value={String(anual.dias_tomados)} />
            <StatCard
              label="Pendientes"
              value={String(anual.dias_pendientes)}
              highlight={
                anual.dias_pendientes < 0
                  ? 'rojo'
                  : anual.dias_pendientes === 0
                    ? 'amarillo'
                    : 'verde'
              }
            />
            <StatCard
              label="Modo"
              value={anual.modo_conteo === 'HABILES' ? 'Habiles' : 'Corridos'}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Este empleado todavia no tiene saldo cargado para {anio}.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          {!anual && (
            <button
              onClick={() => setModalSaldo(true)}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium"
            >
              Cargar saldo inicial
            </button>
          )}
          {anual && anual.estado === 'ABIERTA' && (
            <button
              onClick={() => setModalPeriodo(true)}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium"
            >
              + Nuevo periodo
            </button>
          )}
          {anual && anual.estado === 'CERRADA' && (
            <p className="text-sm text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
              El año {anio} esta cerrado. No se pueden cargar periodos.
            </p>
          )}
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-medium text-slate-700">
            Periodos cargados ({novedades.length})
          </h2>
        </header>

        {novedades.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 text-center">
            Sin periodos cargados todavia.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {novedades.map((n) => (
              <li
                key={n.id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <div className="font-medium text-sm">
                    {formatFecha(n.desde)} {'->'} {formatFecha(n.hasta)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {n.dias_computados} dias
                    {n.observacion ? ` - ${n.observacion}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {n.estado === 'ACTIVA' && anual?.estado === 'ABIERTA' && (
                    <>
                      <button
                        onClick={() => setEditando(n.id)}
                        disabled={accion}
                        className="text-xs text-slate-700 underline hover:text-slate-900 disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarPeriodo(n.id)}
                        disabled={accion}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  {n.estado !== 'ACTIVA' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {n.estado}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modalSaldo && (
        <ModalCargarSaldo
          anio={anio}
          empleadoId={empleadoId}
          onCerrar={() => setModalSaldo(false)}
          onGuardado={async () => {
            setModalSaldo(false)
            await cargar()
          }}
        />
      )}

      {modalPeriodo && anual && (
        <ModalNuevoPeriodo
          anio={anio}
          empleadoId={empleadoId}
          modo={anual.modo_conteo}
          pendientes={anual.dias_pendientes}
          onCerrar={() => setModalPeriodo(false)}
          onGuardado={async () => {
            setModalPeriodo(false)
            await cargar()
          }}
          onVerImpacto={(desde, hasta) => {
            setImpactoParams({ desde, hasta })
          }}
        />
      )}

      {editando !== null && anual && novedades.find((n) => n.id === editando) && (
        <ModalNuevoPeriodo
          anio={anio}
          empleadoId={empleadoId}
          modo={anual.modo_conteo}
          pendientes={anual.dias_pendientes}
          novedad={novedades.find((n) => n.id === editando) ?? null}
          onCerrar={() => setEditando(null)}
          onGuardado={async () => {
            setEditando(null)
            await cargar()
          }}
          onVerImpacto={(desde, hasta) => {
            setImpactoParams({ desde, hasta })
          }}
        />
      )}

      {impactoParams && (
        <ModalImpacto
          anio={anio}
          empleadoId={empleadoId}
          empleadoNombre={`${empleado.apellido}, ${empleado.nombre}`}
          desde={impactoParams.desde}
          hasta={impactoParams.hasta}
          onCerrar={() => setImpactoParams(null)}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: 'verde' | 'amarillo' | 'rojo'
}) {
  let color = 'text-slate-900'
  if (highlight === 'verde') color = 'text-green-700'
  else if (highlight === 'amarillo') color = 'text-amber-700'
  else if (highlight === 'rojo') color = 'text-red-700'
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  )
}

// ----------------------------------------------------------------------
// Modal cargar saldo inicial
// ----------------------------------------------------------------------
function ModalCargarSaldo({
  anio,
  empleadoId,
  onCerrar,
  onGuardado,
}: {
  anio: number
  empleadoId: number
  onCerrar: () => void
  onGuardado: () => Promise<void> | void
}) {
  const [dias, setDias] = useState(28)
  const [modo, setModo] = useState<ModoConteo>('HABILES')
  const [observacion, setObservacion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setError(null)
    setLoading(true)
    try {
      await api.cargarSaldoVacaciones(anio, empleadoId, {
        dias_totales: dias,
        modo_conteo: modo,
        observacion: observacion || null,
      })
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Cargar saldo {anio}</h2>
        <p className="text-sm text-slate-600">
          Es lo que te informo RRHH. Se usa como limite de dias disponibles
          para este año vacacional.
        </p>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Dias totales
          </span>
          <input
            type="number"
            min={0}
            max={365}
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className={inputCls}
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">Modo</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={modo === 'HABILES'}
              onChange={() => setModo('HABILES')}
            />
            Habiles (sin sabados, domingos ni feriados)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={modo === 'CORRIDOS'}
              onChange={() => setModo('CORRIDOS')}
            />
            Corridos (todos los dias)
          </label>
        </fieldset>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Observacion (opcional)
          </span>
          <input
            type="text"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            className={inputCls}
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
            className="w-full rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            onClick={onCerrar}
            disabled={loading}
            className="w-full rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------
// Modal nuevo periodo
// ----------------------------------------------------------------------
function ModalNuevoPeriodo({
  anio,
  empleadoId,
  modo,
  pendientes,
  novedad = null,
  onCerrar,
  onGuardado,
  onVerImpacto,
}: {
  anio: number
  empleadoId: number
  modo: ModoConteo
  pendientes: number
  novedad?: NovedadVacaciones | null
  onCerrar: () => void
  onGuardado: () => Promise<void> | void
  onVerImpacto: (desde: string, hasta: string) => void
}) {
  const editando = novedad !== null
  const [desde, setDesde] = useState<string | null>(
    novedad?.desde ?? null,
  )
  const [dias, setDias] = useState(novedad?.dias_computados ?? 7)
  const [observacion, setObservacion] = useState(novedad?.observacion ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avisoExceso, setAvisoExceso] = useState<ErrorDetalle | null>(null)

  async function guardar(confirmarExceso: boolean = false) {
    if (!desde) {
      setError('Falta la fecha de inicio')
      return
    }
    setError(null)
    setLoading(true)
    try {
      if (editando && novedad) {
        await api.editarNovedadVacaciones(
          novedad.id,
          {
            desde,
            dias,
            observacion: observacion || null,
          },
          confirmarExceso,
        )
      } else {
        await api.crearNovedadVacaciones(
          {
            empleado_id: empleadoId,
            anio_vacacional: anio,
            desde,
            dias,
            observacion: observacion || null,
          },
          confirmarExceso,
        )
      }
      await onGuardado()
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.detail) {
        setAvisoExceso(e.detail)
      } else {
        setError(e instanceof ApiError ? e.message : 'Error')
      }
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-900'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <header>
          <h2 className="text-lg font-semibold">
            {editando ? 'Editar periodo' : 'Nuevo periodo'}
          </h2>
          <p className="text-sm text-slate-500">
            Modo: {modo === 'HABILES' ? 'Habiles' : 'Corridos'} - Pendientes:{' '}
            {pendientes} dias
          </p>
        </header>

        <FechaInput
          label="Fecha de inicio"
          required
          value={desde}
          onChange={(iso) => setDesde(iso)}
        />

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Dias a tomar
          </span>
          <input
            type="number"
            min={1}
            max={365}
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className={inputCls}
          />
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
          />
        </label>

        {desde && (
          <button
            type="button"
            onClick={() => onVerImpacto(desde, desde)}
            className="text-sm text-blue-700 underline"
          >
            Ver impacto en cobertura
          </button>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {avisoExceso && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <p className="text-sm text-amber-900 font-medium">
              Exceso de dias
            </p>
            <p className="text-sm text-amber-900">
              {(avisoExceso.mensaje as string) || 'El periodo excede el saldo.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => guardar(true)}
                disabled={loading}
                className="rounded-lg bg-amber-600 text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Guardar de todos modos'}
              </button>
              <button
                onClick={() => setAvisoExceso(null)}
                className="rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm font-medium"
              >
                Volver a editar
              </button>
            </div>
          </div>
        )}

        {!avisoExceso && (
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={() => guardar(false)}
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium disabled:opacity-50"
            >
              {loading
                ? 'Guardando...'
                : editando
                  ? 'Guardar cambios'
                  : 'Guardar periodo'}
            </button>
            <button
              onClick={onCerrar}
              disabled={loading}
              className="w-full rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
