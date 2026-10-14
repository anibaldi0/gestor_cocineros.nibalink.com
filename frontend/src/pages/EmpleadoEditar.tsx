import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { formatDNI, soloDigitos } from '../lib/format'
import FechaInput from '../components/FechaInput'
import type { Empleado, EmpleadoCreate } from '../lib/types'

export default function EmpleadoEditar() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [emp, setEmp] = useState<Empleado | null>(null)
  const [form, setForm] = useState<EmpleadoCreate | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const e = await api.get<Empleado>(`/empleados/${id}`)
      setEmp(e)
      setForm({
        nombre: e.nombre,
        apellido: e.apellido,
        dni: e.dni,
        fecha_ingreso: e.fecha_ingreso,
        fecha_nacimiento: e.fecha_nacimiento,
        telefono: e.telefono,
        tipo_contrato: e.tipo_contrato,
        horas_semana_max: e.horas_semana_max,
        observaciones: e.observaciones,
      })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function set<K extends keyof EmpleadoCreate>(k: K, v: EmpleadoCreate[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form || !emp || !id) return
    setError(null)

    // Confirmacion si cambio el DNI.
    const dniCambio = form.dni !== emp.dni
    if (dniCambio) {
      const ok = window.confirm(
        `Estas por cambiar el DNI de ${emp.apellido}, ${emp.nombre} de ${formatDNI(emp.dni)} a ${formatDNI(form.dni)}. Verifica que sea correcto. Queda registrado en auditoria. Confirmas?`,
      )
      if (!ok) return
    }

    setGuardando(true)
    try {
      await api.patch<Empleado>(`/empleados/${id}`, {
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni,
        fecha_ingreso: form.fecha_ingreso,
        fecha_nacimiento: form.fecha_nacimiento,
        telefono: form.telefono,
        tipo_contrato: form.tipo_contrato,
        horas_semana_max: form.horas_semana_max,
        observaciones: form.observaciones,
      })
      navigate(`/empleados/${id}`, { replace: true })
    } catch (e) {
      if (e instanceof ApiError) setError(e.message)
      else setError('Error inesperado')
    } finally {
      setGuardando(false)
    }
  }

  if (loading)
    return <p className="text-sm text-slate-500">Cargando...</p>
  if (error && !form)
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error}
      </p>
    )
  if (!form || !emp) return null

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-900'
  const labelCls = 'block space-y-1'

  const dniCambio = form.dni !== emp.dni

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => navigate(`/empleados/${emp.id}`)}
        className="text-sm text-slate-500 hover:underline"
      >
        {'<-'} Volver al detalle
      </button>

      <h1 className="text-xl font-semibold tracking-tight">
        Editar empleado
      </h1>

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
            {dniCambio ? (
              <span className="text-xs text-amber-700">
                Cambio de DNI: era {formatDNI(emp.dni)}
              </span>
            ) : (
              form.dni && (
                <span className="text-xs text-slate-400">
                  Se guarda como: {formatDNI(form.dni)}
                </span>
              )
            )}
          </label>

          <label className={labelCls}>
            <span className="text-sm font-medium text-slate-700">
              Horas semanales max.
            </span>
            <input
              type="number"
              min={1}
              max={168}
              className={inputCls}
              value={form.horas_semana_max}
              onChange={(e) =>
                set('horas_semana_max', Number(e.target.value))
              }
            />
          </label>

          <FechaInput
            label="Fecha de ingreso"
            required
            value={form.fecha_ingreso}
            onChange={(iso) => set('fecha_ingreso', iso ?? form.fecha_ingreso)}
          />

          <FechaInput
            label="Fecha de nacimiento"
            value={form.fecha_nacimiento ?? null}
            onChange={(iso) => set('fecha_nacimiento', iso)}
          />

          <label className={labelCls}>
            <span className="text-sm font-medium text-slate-700">Telefono</span>
            <input
              className={inputCls}
              value={form.telefono ?? ''}
              onChange={(e) => set('telefono', e.target.value || null)}
            />
          </label>
          <label className={labelCls}>
            <span className="text-sm font-medium text-slate-700">
              Tipo de contrato
            </span>
            <input
              className={inputCls}
              value={form.tipo_contrato ?? ''}
              onChange={(e) => set('tipo_contrato', e.target.value || null)}
            />
          </label>
        </div>

        <label className={labelCls}>
          <span className="text-sm font-medium text-slate-700">
            Observaciones
          </span>
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
            disabled={guardando}
            className="w-full sm:w-auto rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/empleados/${emp.id}`)}
            className="w-full sm:w-auto rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
