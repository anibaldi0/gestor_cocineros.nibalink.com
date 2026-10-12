import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/use-auth'
import ModalChangePassword from '../components/ModalChangePassword'

export default function Inicio() {
  const { user, refresh } = useAuth()
  const [cambioPassAbierto, setCambioPassAbierto] = useState(false)
  const esSoloEmpleado =
    (user?.roles.includes('EMPLEADO') ?? false) &&
    !(user?.roles.includes('EDITOR') ?? false) &&
    !(user?.roles.includes('SUPERADMIN') ?? false)

  return (
    <div className="max-w-md mx-auto space-y-6 pt-4">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Hola, {user?.username}
        </h1>
        <p className="text-sm text-slate-500">
          ¿Que queres hacer hoy?
        </p>
      </header>

      {esSoloEmpleado ? (
        <div className="grid grid-cols-1 gap-3">
          <Link
            to="/mi-dashboard"
            className="block bg-white rounded-2xl border border-slate-200 p-5 active:bg-slate-50 hover:border-slate-400 transition-colors"
          >
            <div className="text-base font-semibold text-slate-900">
              Mi panel
            </div>
            <div className="text-sm text-slate-500 mt-1">
              Tus turnos del mes, francos, vacaciones y feriados.
            </div>
          </Link>

          <Link
            to="/grilla"
            className="block bg-white rounded-2xl border border-slate-200 p-5 active:bg-slate-50 hover:border-slate-400 transition-colors"
          >
            <div className="text-base font-semibold text-slate-900">
              Grilla
            </div>
            <div className="text-sm text-slate-500 mt-1">
              La grilla completa del mes con todos tus companeros.
            </div>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <Link
            to="/grilla"
            className="block bg-white rounded-2xl border border-slate-200 p-5 active:bg-slate-50 hover:border-slate-400 transition-colors"
          >
            <div className="text-base font-semibold text-slate-900">
              Grilla
            </div>
            <div className="text-sm text-slate-500 mt-1">
              Arma y publica la grilla del mes.
            </div>
          </Link>
          <Link
            to="/calendario"
            className="block bg-white rounded-2xl border border-slate-200 p-5 active:bg-slate-50 hover:border-slate-400 transition-colors"
          >
            <div className="text-base font-semibold text-slate-900">
              Calendario
            </div>
            <div className="text-sm text-slate-500 mt-1">
              Feriados, recesos y vacaciones escolares.
            </div>
          </Link>
          <Link
            to="/empleados"
            className="block bg-white rounded-2xl border border-slate-200 p-5 active:bg-slate-50 hover:border-slate-400 transition-colors"
          >
            <div className="text-base font-semibold text-slate-900">
              Empleados
            </div>
            <div className="text-sm text-slate-500 mt-1">
              Plantel, datos y accesos al sistema.
            </div>
          </Link>
        </div>
      )}

      <div className="border-t border-slate-200 pt-4 flex justify-center">
        <button
          type="button"
          onClick={() => {
            const ok = window.confirm(
              'Queres cambiar tu contrasena?',
            )
            if (ok) setCambioPassAbierto(true)
          }}
          className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
        >
          Cambiar contrasena
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center pt-2">
        La grilla oficial esta publicada en la pizarra y en esta pantalla.
      </p>

      {cambioPassAbierto && (
        <ModalChangePassword
          onDone={async () => {
            setCambioPassAbierto(false)
            await refresh()
          }}
          onCancelar={() => setCambioPassAbierto(false)}
        />
      )}
    </div>
  )
}
