import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type { Empleado, ResetPasswordResponse } from '../lib/types'
import { useAuth } from '../lib/use-auth'
import PasswordInput from '../components/PasswordInput'
import { formatDNI } from '../lib/format'
import { fechaHoraRelativa } from '../lib/fechas'

export default function EmpleadoDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [emp, setEmp] = useState<Empleado | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accion, setAccion] = useState(false)
  const [modalBaja, setModalBaja] = useState(false)
  const [resumenLogins, setResumenLogins] = useState<{
    total: number
    ultimo_login: string | null
  } | null>(null)

  const esSuper = user?.roles.includes('SUPERADMIN') ?? false
  const puedeEditar =
    (user?.roles.includes('EDITOR') || user?.roles.includes('SUPERADMIN')) ?? false

  async function cargar() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setEmp(await api.get<Empleado>(`/empleados/${id}`))
      try {
        const l = await api.loginsDeEmpleado(Number(id))
        setResumenLogins({
          total: l.total,
          ultimo_login: l.ultimo_login,
        })
      } catch {
        setResumenLogins(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function pedirBaja() {
    if (!emp) return
    const ok = window.confirm(
      `Seguro que queres dar de baja a ${emp.apellido}, ${emp.nombre}?`,
    )
    if (ok) setModalBaja(true)
  }

  async function desactivar() {
    if (!emp) return
    setAccion(true)
    try {
      await api.delete(`/empleados/${emp.id}`)
      setModalBaja(false)
      await cargar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setAccion(false)
    }
  }

  async function reactivar() {
    if (!emp) return
    const ok = window.confirm(
      `Reactivar a ${emp.apellido}, ${emp.nombre}? Se limpia la fecha de baja y se preserva su historial.`,
    )
    if (!ok) return
    setAccion(true)
    try {
      await api.post(`/empleados/${emp.id}/reactivar`)
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
  if (!emp) return null

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => navigate('/empleados')}
        className="text-sm text-slate-500 hover:underline"
      >
        {'<-'} Volver a empleados
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              Empleado
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              {emp.apellido}, {emp.nombre}
            </h1>
            <p className="text-sm text-slate-500">DNI {formatDNI(emp.dni)}</p>
          </div>
          <div className="flex items-center gap-2">
            {puedeEditar && (
              <button
                onClick={() => navigate(`/empleados/${emp.id}/editar`)}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200"
              >
                Editar
              </button>
            )}
            {emp.activo ? (
              <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">
                Activo
              </span>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                Inactivo
              </span>
            )}
          </div>
        </header>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Item label="Fecha de ingreso" value={emp.fecha_ingreso} />
          <Item label="Tipo de contrato" value={emp.tipo_contrato ?? '-'} />
          <Item label="Horas semanales max." value={String(emp.horas_semana_max)} />
          <Item label="Telefono" value={emp.telefono ?? '-'} />
          <Item label="Fecha de nacimiento" value={emp.fecha_nacimiento ?? '-'} />
          <Item label="Fecha de baja" value={emp.fecha_baja ?? '-'} />
        </dl>

        {emp.observaciones && (
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              Observaciones
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {emp.observaciones}
            </p>
          </div>
        )}
      </div>

      {resumenLogins && emp.usuario && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6">
          <h2 className="text-sm font-medium text-slate-700 mb-1">
            Accesos al sistema
          </h2>
          <p className="text-sm text-slate-600">
            <strong>{resumenLogins.total}</strong> ingreso(s).
            {resumenLogins.ultimo_login
              ? ` Ultimo: ${fechaHoraRelativa(resumenLogins.ultimo_login)}.`
              : ' Nunca ingreso.'}
          </p>
        </div>
      )}

      <SeccionUsuario
        empleado={emp}
        editable={puedeEditar}
        onRefresh={cargar}
      />

      {puedeEditar && (
        <div
          className={
            emp.activo
              ? 'bg-white rounded-2xl border border-red-200 p-4 sm:p-6'
              : 'bg-white rounded-2xl border border-emerald-200 p-4 sm:p-6'
          }
        >
          <h2
            className={
              emp.activo
                ? 'text-sm font-medium text-red-700 mb-2'
                : 'text-sm font-medium text-emerald-700 mb-2'
            }
          >
            {emp.activo ? 'Baja del empleado' : 'Reactivar empleado'}
          </h2>
          {emp.activo ? (
            <>
              <p className="text-sm text-slate-600 mb-3">
                Marca al empleado como inactivo. No se borran datos: turnos, francos y novedades quedan guardados. Tambien se desactiva automaticamente su usuario del sistema para que no pueda ingresar.
              </p>
              <button
                onClick={pedirBaja}
                disabled={accion}
                className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {accion ? 'Procesando...' : 'Desactivar empleado'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-3">
                Reactivar preserva el historial (turnos, francos, novedades).
                La fecha de baja se limpia y se mantiene la fecha de ingreso
                original. Si el usuario vinculado estaba inactivo, se puede
                rotar el username y la contrasena en el mismo paso.
              </p>
              <button
                onClick={reactivar}
                disabled={accion}
                className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {accion ? 'Procesando...' : 'Reactivar empleado'}
              </button>
            </>
          )}
        </div>
      )}

      {modalBaja && emp && (
        <ModalConfirmarBaja
          empleado={emp}
          procesando={accion}
          onConfirmar={desactivar}
          onCancelar={() => setModalBaja(false)}
        />
      )}
    </div>
  )
}

function ModalConfirmarBaja({
  empleado,
  procesando,
  onConfirmar,
  onCancelar,
}: {
  empleado: Empleado
  procesando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  const [texto, setTexto] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !procesando) onCancelar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancelar, procesando])

  const PALABRA = 'BAJA'
  const coincide = texto.trim().toUpperCase() === PALABRA

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !procesando && onCancelar()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl border border-red-200 p-6 space-y-4"
      >
        <header>
          <h2 className="text-lg font-semibold text-red-700">
            Confirmar baja del empleado
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Vas a marcar a <strong>{empleado.apellido}, {empleado.nombre}</strong>{' '}
            como inactivo. No se borran datos: turnos, francos y novedades
            quedan guardados. Tambien se desactiva su usuario del sistema.
          </p>
        </header>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Para confirmar, escribi la palabra:
          </span>
          <span className="block text-center font-mono font-bold text-lg bg-slate-100 border border-slate-200 rounded px-2 py-2 text-slate-800 select-all tracking-widest">
            BAJA
          </span>
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribi BAJA"
            autoFocus
            autoCapitalize="characters"
            autoCorrect="off"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-center uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </label>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={onConfirmar}
            disabled={!coincide || procesando}
            className="w-full sm:w-auto rounded-lg bg-red-600 text-white px-4 py-3 text-base font-medium disabled:opacity-40"
          >
            {procesando ? 'Procesando...' : 'Confirmar baja'}
          </button>
          <button
            onClick={onCancelar}
            disabled={procesando}
            className="w-full sm:w-auto rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200 disabled:opacity-50"
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


function SeccionUsuario({
  empleado,
  editable,
  onRefresh,
}: {
  empleado: Empleado
  editable: boolean
  onRefresh: () => Promise<void> | void
}) {
  const [creando, setCreando] = useState(false)
  const [username, setUsername] = useState('')
  const [passwordManual, setPasswordManual] = useState('')
  const [usarAuto, setUsarAuto] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetPass, setResetPass] = useState<ResetPasswordResponse | null>(null)
  const [modalBajaUsuario, setModalBajaUsuario] = useState(false)

  const usuario = empleado.usuario

  async function crear() {
    setError(null)
    if (username.trim().length < 3) {
      setError('El username debe tener al menos 3 caracteres')
      return
    }
    setProcesando(true)
    try {
      const res = await api.crearUsuarioDeEmpleado(empleado.id, {
        username: username.trim().toLowerCase(),
        password: usarAuto ? null : passwordManual,
      })
      setCreando(false)
      setUsername('')
      setPasswordManual('')
      if (res.password_temporal) {
        setResetPass({
          usuario_id: res.id,
          username: res.username,
          password_temporal: res.password_temporal,
          debe_cambiar_password: true,
        })
      }
      await onRefresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setProcesando(false)
    }
  }

  async function resetear() {
    if (!usuario) return
    const ok = window.confirm(
      `Resetear la password de "${usuario.username}"?`,
    )
    if (!ok) return
    setProcesando(true)
    try {
      const res = await api.resetPasswordDeEmpleado(empleado.id)
      // No llamamos a onRefresh() aca porque el padre hace
      // setLoading(true) y desmonta este componente, perdiendo el
      // estado del modal. La UI del panel no cambia con un reset.
      setResetPass(res)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setProcesando(false)
    }
  }

  function pedirBajaUsuario() {
    if (!usuario) return
    const ok = window.confirm(
      `Seguro que queres desactivar el acceso al sistema del usuario "${usuario.username}"?`,
    )
    if (ok) setModalBajaUsuario(true)
  }

  async function ejecutarBajaUsuario() {
    if (!usuario) return
    setProcesando(true)
    try {
      await api.actualizarUsuarioDeEmpleado(empleado.id, { activo: false })
      setModalBajaUsuario(false)
      await onRefresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setProcesando(false)
    }
  }

  async function reactivarUsuario() {
    if (!usuario) return
    const ok = window.confirm(
      `Reactivar el acceso al sistema del usuario "${usuario.username}"?`,
    )
    if (!ok) return
    setProcesando(true)
    try {
      await api.actualizarUsuarioDeEmpleado(empleado.id, { activo: true })
      await onRefresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setProcesando(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-900'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-slate-700">
            Usuario del sistema
          </h2>
          <p className="text-xs text-slate-500">
            Credenciales para que este empleado vea su dashboard personal.
            Desactivar el usuario bloquea el acceso, pero NO da de baja al
            empleado.
          </p>
        </div>
        {usuario && (
          <span
            className={
              usuario.activo
                ? 'text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700'
                : 'text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500'
            }
          >
            {usuario.activo ? 'Activo' : 'Inactivo'}
          </span>
        )}
      </header>

      {usuario ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Usuario
              </dt>
              <dd className="text-slate-800 font-mono">{usuario.username}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Contrasena
              </dt>
              <dd>
                {usuario.debe_cambiar_password ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Temporal sin cambiar
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                    Modificada por el usuario
                  </span>
                )}
              </dd>
            </div>
          </dl>

          {editable && (
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={resetear}
                disabled={procesando}
                className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {procesando ? 'Procesando...' : 'Resetear contrasena'}
              </button>
              {usuario.activo ? (
                <button
                  onClick={pedirBajaUsuario}
                  disabled={procesando}
                  className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Desactivar usuario
                </button>
              ) : (
                <button
                  onClick={reactivarUsuario}
                  disabled={procesando}
                  className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Reactivar usuario
                </button>
              )}
            </div>
          )}
        </div>
      ) : editable ? (
        creando ? (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Username *
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputCls}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="ej: juan, maria.gonzalez"
              />
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">
                Contrasena inicial
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={usarAuto}
                  onChange={() => setUsarAuto(true)}
                />
                Generar automatica
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={!usarAuto}
                  onChange={() => setUsarAuto(false)}
                />
                Cargar manualmente
              </label>
              {!usarAuto && (
                <PasswordInput
                  value={passwordManual}
                  onChange={setPasswordManual}
                  placeholder="Minimo 6 caracteres"
                  className={inputCls}
                  minLength={6}
                />
              )}
            </fieldset>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={crear}
                disabled={procesando}
                className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {procesando ? 'Creando...' : 'Crear usuario'}
              </button>
              <button
                onClick={() => {
                  setCreando(false)
                  setError(null)
                }}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Este empleado todavia no tiene usuario para acceder al
              dashboard.
            </p>
            <button
              onClick={() => setCreando(true)}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium"
            >
              Crear usuario
            </button>
          </div>
        )
      ) : (
        <p className="text-sm text-slate-500">
          Sin usuario vinculado. Solo editores pueden crearlo.
        </p>
      )}

      {modalBajaUsuario && usuario && (
        <ModalConfirmarBajaUsuario
          username={usuario.username}
          procesando={procesando}
          onConfirmar={ejecutarBajaUsuario}
          onCancelar={() => setModalBajaUsuario(false)}
        />
      )}

      {resetPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold">
              Contrasena temporal generada
            </h2>
            <p className="text-sm text-slate-600">
              Usuario: <strong>{resetPass.username}</strong>
            </p>
            <p className="font-mono text-lg bg-amber-50 border border-amber-300 rounded px-3 py-2 text-center select-all">
              {resetPass.password_temporal}
            </p>
            <p className="text-xs text-amber-800">
              Copiala y entregasela al empleado. NO se puede recuperar
              despues.
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


function ModalConfirmarBajaUsuario({
  username,
  procesando,
  onConfirmar,
  onCancelar,
}: {
  username: string
  procesando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  const [texto, setTexto] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !procesando) onCancelar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancelar, procesando])

  const PALABRA = 'BAJA'
  const coincide = texto.trim().toUpperCase() === PALABRA

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !procesando && onCancelar()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl border border-red-200 p-6 space-y-4"
      >
        <header>
          <h2 className="text-lg font-semibold text-red-700">
            Confirmar baja del usuario
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Vas a desactivar el acceso al sistema del usuario{' '}
            <strong>{username}</strong>. El empleado no podra loguearse, pero
            sus datos se conservan. Se puede reactivar despues.
          </p>
        </header>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Para confirmar, escribi la palabra:
          </span>
          <span className="block text-center font-mono font-bold text-lg bg-slate-100 border border-slate-200 rounded px-2 py-2 text-slate-800 select-all tracking-widest">
            BAJA
          </span>
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribi BAJA"
            autoFocus
            autoCapitalize="characters"
            autoCorrect="off"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-center uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </label>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={onConfirmar}
            disabled={!coincide || procesando}
            className="w-full sm:w-auto rounded-lg bg-red-600 text-white px-4 py-3 text-base font-medium disabled:opacity-40"
          >
            {procesando ? 'Procesando...' : 'Confirmar baja'}
          </button>
          <button
            onClick={onCancelar}
            disabled={procesando}
            className="w-full sm:w-auto rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
