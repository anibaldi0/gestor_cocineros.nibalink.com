import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type {
  Empleado,
  ResetPasswordResponse,
  Rol,
  UsuarioDetalle as UsuarioDetalleType,
} from '../lib/types'
import { useAuth } from '../lib/use-auth'

export default function UsuarioDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [usuario, setUsuario] = useState<UsuarioDetalleType | null>(null)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accion, setAccion] = useState(false)
  const [resetPass, setResetPass] = useState<ResetPasswordResponse | null>(null)

  const esSuper = user?.roles.includes('SUPERADMIN') ?? false
  const esEditor = user?.roles.includes('EDITOR') ?? false
  const puedeGestionar =
    esSuper || (esEditor && usuario?.roles.length === 1 && usuario.roles[0] === 'EMPLEADO')
  const esMismo = user?.id === usuario?.id

  async function cargar() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setUsuario(await api.usuario(Number(id)))
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

  useEffect(() => {
    if (!esSuper && !esEditor) return
    void (async () => {
      try {
        setEmpleados(await api.get<Empleado[]>('/empleados?activo=true'))
      } catch {
        setEmpleados([])
      }
    })()
  }, [esSuper, esEditor])

  async function cambiarRol(nuevo: Rol) {
    if (!usuario) return
    setAccion(true)
    try {
      await api.actualizarUsuario(usuario.id, { rol: nuevo })
      await cargar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setAccion(false)
    }
  }

  async function cambiarEmpleado(empId: number | null) {
    if (!usuario) return
    setAccion(true)
    try {
      await api.actualizarUsuario(usuario.id, { empleado_id: empId })
      await cargar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setAccion(false)
    }
  }

  async function desactivar() {
    if (!usuario) return
    const ok = window.confirm(
      `Desactivar al usuario "${usuario.username}"? No se borran datos.`,
    )
    if (!ok) return
    setAccion(true)
    try {
      await api.desactivarUsuario(usuario.id)
      await cargar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setAccion(false)
    }
  }

  async function reactivar() {
    if (!usuario) return
    setAccion(true)
    try {
      await api.actualizarUsuario(usuario.id, { activo: true })
      await cargar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setAccion(false)
    }
  }

  async function resetearPassword() {
    if (!usuario) return
    const ok = window.confirm(
      `Resetear password de "${usuario.username}"? Se genera una nueva y el usuario debera cambiarla en el proximo login.`,
    )
    if (!ok) return
    setAccion(true)
    try {
      const res = await api.resetPasswordUsuario(usuario.id)
      setResetPass(res)
      await cargar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
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
  if (!usuario) return null

  const rolActual = usuario.roles[0] ?? 'EMPLEADO'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => navigate('/usuarios')}
        className="text-sm text-slate-500 hover:underline"
      >
        {'<-'} Volver a usuarios
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {usuario.username}
            </h1>
            <p className="text-sm text-slate-500">
              {usuario.roles.join(', ')}
              {usuario.empleado_nombre && ` - ${usuario.empleado_nombre}`}
            </p>
          </div>
          <div className="flex flex-col gap-1 items-end">
            {usuario.activo ? (
              <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">
                Activo
              </span>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                Inactivo
              </span>
            )}
            {usuario.debe_cambiar_password && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                Debe cambiar password
              </span>
            )}
          </div>
        </header>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Item label="Username" value={usuario.username} />
          <Item label="Rol" value={usuario.roles.join(', ')} />
          <Item
            label="Empleado vinculado"
            value={usuario.empleado_nombre ?? '-'}
          />
          <Item
            label="Creado"
            value={new Date(usuario.fecha_creacion).toLocaleDateString('es-AR')}
          />
        </dl>
      </div>

      {puedeGestionar && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-medium text-slate-700">
            Administracion
          </h2>

          {esSuper && (
            <label className="block space-y-1">
              <span className="text-sm text-slate-600">Rol</span>
              <select
                value={rolActual}
                onChange={(e) => cambiarRol(e.target.value as Rol)}
                disabled={accion || esMismo}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base disabled:opacity-50"
              >
                <option value="EMPLEADO">Empleado</option>
                <option value="EDITOR">Editor</option>
                <option value="SUPERADMIN">Superadmin</option>
              </select>
              {esMismo && (
                <span className="text-xs text-slate-400">
                  No podes cambiar tu propio rol.
                </span>
              )}
            </label>
          )}

          {esSuper && rolActual === 'EMPLEADO' && (
            <label className="block space-y-1">
              <span className="text-sm text-slate-600">
                Empleado vinculado
              </span>
              <select
                value={usuario.empleado_id ?? ''}
                onChange={(e) =>
                  cambiarEmpleado(e.target.value ? Number(e.target.value) : null)
                }
                disabled={accion}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base disabled:opacity-50"
              >
                <option value="">-- Sin vincular --</option>
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.apellido}, {emp.nombre} (DNI {emp.dni})
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <button
              onClick={resetearPassword}
              disabled={accion}
              className="w-full sm:w-auto rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Resetear password
            </button>
            <p className="text-xs text-slate-500">
              Genera una password temporal nueva. El usuario debera cambiarla
              en el proximo login.
            </p>
          </div>
        </div>
      )}

      {puedeGestionar && !esMismo && (
        <div
          className={
            usuario.activo
              ? 'bg-white rounded-2xl border border-red-200 p-4 sm:p-6'
              : 'bg-white rounded-2xl border border-emerald-200 p-4 sm:p-6'
          }
        >
          <h2
            className={
              usuario.activo
                ? 'text-sm font-medium text-red-700 mb-2'
                : 'text-sm font-medium text-emerald-700 mb-2'
            }
          >
            {usuario.activo ? 'Desactivar' : 'Reactivar'}
          </h2>
          <p className="text-sm text-slate-600 mb-3">
            {usuario.activo
              ? 'Desactivar no borra datos. Se puede reactivar despues.'
              : 'Reactivar para que el usuario pueda volver a ingresar.'}
          </p>
          {usuario.activo ? (
            <button
              onClick={desactivar}
              disabled={accion}
              className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {accion ? 'Procesando...' : 'Desactivar usuario'}
            </button>
          ) : (
            <button
              onClick={reactivar}
              disabled={accion}
              className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {accion ? 'Procesando...' : 'Reactivar'}
            </button>
          )}
        </div>
      )}

      {resetPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold">
              Password temporal generada
            </h2>
            <p className="text-sm text-slate-600">
              Para el usuario <strong>{resetPass.username}</strong>:
            </p>
            <p className="font-mono text-lg bg-amber-50 border border-amber-300 rounded px-3 py-2 text-center select-all">
              {resetPass.password_temporal}
            </p>
            <p className="text-xs text-amber-800">
              Copiala y entregasela al usuario. NO se puede recuperar
              despues. El usuario va a tener que cambiarla en el proximo
              login.
            </p>
            <button
              onClick={() => setResetPass(null)}
              className="w-full rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  )
}
