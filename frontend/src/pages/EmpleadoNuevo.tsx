import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, type ErrorDetalle } from '../lib/api'
import { formatDNI, soloDigitos } from '../lib/format'
import type { Empleado, EmpleadoCreate } from '../lib/types'

const hoy = new Date().toISOString().slice(0, 10)

const inicial: EmpleadoCreate = {
  nombre: '',
  apellido: '',
  dni: '',
  fecha_ingreso: hoy,
  fecha_nacimiento: null,
  telefono: null,
  tipo_contrato: 'Efectivo',
  horas_semana_max: 40,
  observaciones: null,
}

interface ReactivacionState {
  detalle: ErrorDetalle
  existente: Empleado
}

export default function EmpleadoNuevo() {
  const navigate = useNavigate()
  const [form, setForm] = useState<EmpleadoCreate>(inicial)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [reactivacion, setReactivacion] = useState<ReactivacionState | null>(null)
  const [reactivando, setReactivando] = useState(false)

  function set<K extends keyof EmpleadoCreate>(k: K, v: EmpleadoCreate[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const creado = await api.post<Empleado>('/empleados', form)
      navigate(`/empleados/${creado.id}`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.detail) {
        const existente = err.detail.empleado_existente as Empleado | undefined
        if (existente) {
          setReactivacion({ detalle: err.detail, existente })
          return
        }
      }
      if (err instanceof ApiError) setError(err.message)
      else setError('Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  async function confirmarReactivacion() {
    if (!reactivacion) return
    setReactivando(true)
    try {
      const { id } = reactivacion.existente
      const payload: Record<string, unknown> = {
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni,
        telefono: form.telefono,
        tipo_contrato: form.tipo_contrato,
        horas_semana_max: form.horas_semana_max,
        observaciones: form.observaciones,
      }
      const actualizado = await api.post<Empleado>(
        `/empleados/${id}/reactivar`,
        payload,
      )
      navigate(`/empleados/${actualizado.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al reactivar')
      setReactivacion(null)
    } finally {
      setReactivando(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-900'
  const labelCls = 'block space-y-1'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Nuevo empleado</h1>

      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className={labelCls}>
            <span className="text-sm font-medium text-slate-700">Nombre *</span>
            <input
              className={inputCls}
              value={form.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              required
            />
          </label>
          <label className={labelCls}>
            <span className="text-sm font-medium text-slate-700">Apellido *</span>
            <input
              className={inputCls}
              value={form.apellido}
              onChange={(e) => set('apellido', e.target.value)}
              required
            />
          </label>
          <label className={labelCls}>
            <span className="text-sm font-medium text-slate-700">DNI *</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              className={inputCls}
              value={form.dni}
              onChange={(e) => set('dni', soloDigitos(e.target.value))}
              required
            />
            {form.dni && (
              <span className="text-xs text-slate-400">
                Se guarda como: {formatDNI(form.dni)}
              </span>
            )}
          </label>
          <label className={labelCls}>
            <span className="text-sm font-medium text-slate-700">Fecha de ingreso *</span>
            <input
              type="date"
              className={inputCls}
              value={form.fecha_ingreso}
              onChange={(e) => set('fecha_ingreso', e.target.value)}
              required
            />
          </label>
          <label className={labelCls}>
            <span className="text-sm font-medium text-slate-700">Fecha de nacimiento</span>
            <input
              type="date"
              className={inputCls}
              value={form.fecha_nacimiento ?? ''}
              onChange={(e) => set('fecha_nacimiento', e.target.value || null)}
            />
          </label>
          <label className={labelCls}>
            <span className="text-sm font-medium text-slate-700">Telefono</span>
            <input
              className={inputCls}
              value={form.telefono ?? ''}
              onChange={(e) => set('telefono', e.target.value || null)}
            />
          </label>
          <label className={labelCls}>
            <span className="text-sm font-medium text-slate-700">Tipo de contrato</span>
            <input
              className={inputCls}
              value={form.tipo_contrato ?? ''}
              onChange={(e) => set('tipo_contrato', e.target.value || null)}
            />
          </label>
          <label className={labelCls}>
            <span className="text-sm font-medium text-slate-700">Horas semanales max.</span>
            <input
              type="number"
              min={1}
              max={168}
              className={inputCls}
              value={form.horas_semana_max}
              onChange={(e) => set('horas_semana_max', Number(e.target.value))}
            />
          </label>
        </div>

        <label className={labelCls}>
          <span className="text-sm font-medium text-slate-700">Observaciones</span>
          <textarea
            className={inputCls}
            rows={3}
            value={form.observaciones ?? ''}
            onChange={(e) => set('observaciones', e.target.value || null)}
          />
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="submit"
            disabled={loading || reactivando}
            className="w-full sm:w-auto rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium disabled:opacity-50 active:bg-slate-800"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/empleados')}
            className="w-full sm:w-auto rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
          >
            Cancelar
          </button>
        </div>
      </form>

      {reactivacion && (
        <ModalReactivacion
          existente={reactivacion.existente}
          activo={reactivacion.detalle.codigo === 'DNI_DUPLICADO_ACTIVO'}
          procesando={reactivando}
          onConfirmar={confirmarReactivacion}
          onVerDetalle={() => {
            navigate(`/empleados/${reactivacion.existente.id}`)
          }}
          onCancelar={() => setReactivacion(null)}
        />
      )}
    </div>
  )
}

interface ModalProps {
  existente: Empleado
  activo: boolean
  procesando: boolean
  onConfirmar: () => void
  onVerDetalle: () => void
  onCancelar: () => void
}

function ModalReactivacion({
  existente,
  activo,
  procesando,
  onConfirmar,
  onVerDetalle,
  onCancelar,
}: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <header>
          <h2 className="text-lg font-semibold">
            {activo
              ? 'Ya existe un empleado activo'
              : 'Ya existe un empleado con este DNI'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {activo
              ? 'Este DNI ya esta registrado y activo. Queres ver el registro existente?'
              : 'Encontramos un registro previo con el mismo DNI. Es la misma persona que esta volviendo?'}
          </p>
        </header>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm bg-slate-50 rounded-xl p-4">
          <Item
            label="Apellido, Nombre"
            value={`${existente.apellido}, ${existente.nombre}`}
          />
          <Item label="DNI" value={formatDNI(existente.dni)} />
          <Item label="Ingreso original" value={existente.fecha_ingreso} />
          <Item
            label="Fecha de baja"
            value={existente.fecha_baja ?? 'Sin fecha de baja'}
          />
          <Item label="Telefono" value={existente.telefono ?? '-'} />
          <Item label="Estado" value={existente.activo ? 'Activo' : 'Inactivo'} />
          {existente.observaciones && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Observaciones
              </dt>
              <dd className="text-slate-700 whitespace-pre-wrap">
                {existente.observaciones}
              </dd>
            </div>
          )}
        </dl>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          {!activo && (
            <button
              onClick={onConfirmar}
              disabled={procesando}
              className="w-full sm:w-auto rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium disabled:opacity-50"
            >
              {procesando ? 'Reactivando...' : 'Si, reactivar con estos datos'}
            </button>
          )}
          <button
            onClick={onVerDetalle}
            disabled={procesando}
            className="w-full sm:w-auto rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
          >
            Ver registro completo
          </button>
          <button
            onClick={onCancelar}
            disabled={procesando}
            className="w-full sm:w-auto rounded-lg px-4 py-3 text-base font-medium text-slate-500 hover:bg-slate-100"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  )
}
