import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type {
  Empleado,
  Rol,
  UsuarioCreateResponse,
} from '../lib/types'
import { useAuth } from '../lib/use-auth'
import PasswordInput from '../components/PasswordInput'

type ModoPassword = 'auto' | 'manual'

export default function UsuarioNuevo() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [username, setUsername] = useState('')
  const [rol, setRol] = useState<Rol>('EDITOR')
  const [empleadoId, setEmpleadoId] = useState<number | null>(null)
  const [modoPass, setModoPass] = useState<ModoPassword>('auto')
  const [passwordManual, setPasswordManual] = useState('')

  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creado, setCreado] = useState<UsuarioCreateResponse | null>(null)

  const esSuper = user?.roles.includes('SUPERADMIN') ?? false

  // Cargar empleados activos para vincular (solo si el rol es EMPLEADO)
  useEffect(() => {
    void (async () => {
      try {
        const emps = await api.get<Empleado[]>('/empleados?activo=true')
        setEmpleados(emps)
      } catch {
        setEmpleados([])
      }
    })()
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const payload = {
        username: username.trim().toLowerCase(),
        rol,
        empleado_id: null,
        password: modoPass === 'manual' ? passwordManual : null,
      }
      const res = await api.crearUsuario(payload)
      setCreado(res)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  // Si se creo y se autogenero password, mostrar cartel con la temporal
  if (creado) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Usuario creado
        </h1>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4">
          <p className="text-sm text-slate-700">
            El usuario <strong>{creado.username}</strong> fue creado con
            rol <strong>{creado.roles.join(', ')}</strong>.
          </p>

          {creado.password_autogenerada && creado.password_temporal && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-amber-900 font-medium">
                Password temporal generada
              </p>
              <p className="font-mono text-lg bg-white border border-amber-300 rounded px-3 py-2 text-center select-all">
                {creado.password_temporal}
              </p>
              <p className="text-xs text-amber-800">
                Copiala y entregasela al usuario. NO se puede recuperar
                despues. El usuario va a tener que cambiarla en el primer
                login.
              </p>
            </div>
          )}

          {!creado.password_autogenerada && (
            <p className="text-sm text-slate-600">
              El usuario debe cambiar la password en el primer login.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={() => navigate(`/usuarios/${creado.id}`)}
              className="w-full sm:w-auto rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium"
            >
              Ver detalle
            </button>
            <button
              onClick={() => navigate('/usuarios')}
              className="w-full sm:w-auto rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
            >
              Volver a la lista
            </button>
          </div>
        </div>
      </div>
    )
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-900'
  const labelCls = 'block space-y-1'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Nuevo usuario</h1>

      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4"
      >
        <label className={labelCls}>
          <span className="text-sm font-medium text-slate-700">
            Username *
          </span>
          <input
            className={inputCls}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={60}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="text-xs text-slate-400">
            Se guarda en minusculas. Ej: maria, juan.perez
          </span>
        </label>

        <label className={labelCls}>
          <span className="text-sm font-medium text-slate-700">Rol *</span>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
            className={inputCls}
          >
            <option value="EDITOR">Editor</option>
            {esSuper && <option value="SUPERADMIN">Superadmin</option>}
          </select>
          <span className="text-xs text-slate-400">
            Los usuarios EMPLEADO se crean desde el detalle del empleado.
          </span>
        </label>



        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">
            Password
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={modoPass === 'auto'}
              onChange={() => setModoPass('auto')}
            />
            Generar automatica (3 palabras, ej: tigre-come-pan)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={modoPass === 'manual'}
              onChange={() => setModoPass('manual')}
            />
            Cargar manualmente
          </label>
          {modoPass === 'manual' && (
            <PasswordInput
              value={passwordManual}
              onChange={setPasswordManual}
              minLength={6}
              maxLength={100}
              placeholder="Minimo 6 caracteres"
              className={inputCls}
              required
            />
          )}
        </fieldset>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear usuario'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/usuarios')}
            className="w-full sm:w-auto rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
