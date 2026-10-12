import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { formatFecha } from '../lib/format'
import FechaInput from '../components/FechaInput'
import type { Evento, EventoCreate, TipoEvento } from '../lib/types'
import ModalImpactoEvento from '../components/ModalImpactoEvento'
import type { ErrorDetalle } from '../lib/api'

export default function Calendario() {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [eventos, setEventos] = useState<Evento[]>([])
  const [tipos, setTipos] = useState<TipoEvento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<'crear' | number | null>(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const [ev, tp] = await Promise.all([
        api.listarEventos(anio),
        api.tiposEvento(),
      ])
      setEventos(ev)
      setTipos(tp)
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

  async function eliminar(id: number, nombre: string) {
    const ok = window.confirm(
      `Eliminar el evento "${nombre}"? Esta accion no se puede deshacer.`,
    )
    if (!ok) return
    try {
      await api.eliminarEvento(id)
      await cargar()
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Error')
    }
  }

  // Agrupar por tipo
  const agrupados = useMemo(() => {
    const map = new Map<number, Evento[]>()
    for (const e of eventos) {
      if (!map.has(e.tipo_evento_id)) map.set(e.tipo_evento_id, [])
      map.get(e.tipo_evento_id)!.push(e)
    }
    // Ordenar por id de tipo (asi se ve Feriado primero, despues recesos...)
    return Array.from(map.entries())
      .map(([tipoId, items]) => ({
        tipoId,
        tipoNombre: items[0].tipo_evento_nombre,
        tipoColor: items[0].tipo_evento_color,
        items,
      }))
      .sort((a, b) => a.tipoId - b.tipoId)
  }, [eventos])

  const eventoEditando =
    typeof modal === 'number' ? eventos.find((e) => e.id === modal) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Calendario
          </h1>
          <p className="text-sm text-slate-500">
            Feriados, recesos y vacaciones escolares.
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
          <button
            onClick={() => setModal('crear')}
            className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium"
          >
            + Nuevo evento
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando...</p>
      ) : eventos.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-6 text-center">
          No hay eventos cargados para {anio}.
        </p>
      ) : (
        <div className="space-y-4">
          {agrupados.map((g) => (
            <section
              key={g.tipoId}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
            >
              <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ background: g.tipoColor }}
                />
                <h2 className="text-sm font-medium text-slate-700">
                  {g.tipoNombre} ({g.items.length})
                </h2>
              </header>

              <ul className="divide-y divide-slate-100">
                {g.items.map((e) => (
                  <li
                    key={e.id}
                    className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {e.nombre}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatFecha(e.desde)}
                        {e.desde !== e.hasta &&
                          ` -> ${formatFecha(e.hasta)}`}
                        {e.observacion && ` - ${e.observacion}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setModal(e.id)}
                        className="text-xs text-slate-700 underline hover:text-slate-900"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminar(e.id, e.nombre)}
                        className="text-xs text-red-600 underline hover:text-red-800"
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {modal !== null && (
        <ModalEvento
          anio={anio}
          tipos={tipos}
          evento={eventoEditando ?? null}
          onCerrar={() => setModal(null)}
          onGuardado={async () => {
            setModal(null)
            await cargar()
          }}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------
// Modal crear/editar
// ----------------------------------------------------------------------
function ModalEvento({
  anio,
  tipos,
  evento,
  onCerrar,
  onGuardado,
}: {
  anio: number
  tipos: TipoEvento[]
  evento: Evento | null
  onCerrar: () => void
  onGuardado: () => Promise<void> | void
}) {
  const editando = evento !== null
  const [tipoId, setTipoId] = useState<number>(
    evento?.tipo_evento_id ?? tipos[0]?.id ?? 1,
  )
  const [nombre, setNombre] = useState(evento?.nombre ?? '')
  const [desde, setDesde] = useState<string | null>(evento?.desde ?? null)
  const [hasta, setHasta] = useState<string | null>(evento?.hasta ?? null)
  const [observacion, setObservacion] = useState(evento?.observacion ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [impacto, setImpacto] = useState<ErrorDetalle | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading && !impacto) onCerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrar, loading, impacto])

  async function guardar(confirmarImpacto: boolean = false) {
    setError(null)
    if (!nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    if (!desde) {
      setError('Falta la fecha de inicio')
      return
    }
    const hastaFinal = hasta ?? desde
    setLoading(true)
    try {
      if (editando && evento) {
        await api.actualizarEvento(evento.id, {
          tipo_evento_id: tipoId,
          nombre: nombre.trim(),
          desde,
          hasta: hastaFinal,
          observacion: observacion || null,
        })
      } else {
        const payload: EventoCreate = {
          tipo_evento_id: tipoId,
          nombre: nombre.trim(),
          desde,
          hasta: hastaFinal,
          observacion: observacion || null,
        }
        await api.crearEvento(payload, confirmarImpacto)
      }
      await onGuardado()
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.detail) {
        setImpacto(e.detail)
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !loading && onCerrar()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-semibold">
          {editando ? 'Editar evento' : 'Nuevo evento'}
        </h2>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Tipo *
          </span>
          <select
            value={tipoId}
            onChange={(e) => setTipoId(Number(e.target.value))}
            className={inputCls}
          >
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Nombre *
          </span>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Dia de la Independencia"
            className={inputCls}
            maxLength={150}
          />
        </label>

        <FechaInput
          label="Fecha desde"
          required
          value={desde}
          onChange={(iso) => setDesde(iso)}
        />

        <FechaInput
          label="Fecha hasta"
          value={hasta}
          onChange={(iso) => setHasta(iso)}
        />
        <p className="text-xs text-slate-400 -mt-2">
          Si es un solo dia, deja "hasta" vacio. Si es un rango (ej: receso
          invernal), carga ambas.
        </p>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Observacion (opcional)
          </span>
          <input
            type="text"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            className={inputCls}
            maxLength={500}
          />
        </label>

        <p className="text-xs text-slate-400">
          Anio del evento: se calcula solo a partir de la fecha desde.
          {desde && ` Sera ${desde.slice(0, 4)}.`}
        </p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {impacto && (
          <ModalImpactoEvento
            nombreEvento={nombre}
            detalle={impacto}
            procesando={loading}
            onConfirmar={() => guardar(true)}
            onCancelar={() => setImpacto(null)}
          />
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={() => guardar(false)}
            disabled={loading}
            className="w-full sm:w-auto rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium disabled:opacity-50"
          >
            {loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear evento'}
          </button>
          <button
            onClick={onCerrar}
            disabled={loading}
            className="w-full sm:w-auto rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
