import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/use-auth'
import ModalChangePassword from './ModalChangePassword'

const LS_HIDE_BANNER = 'cocina_hide_banner_password'

export default function Layout() {
  const { user, logout, refresh } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [abrirCambioPass, setAbrirCambioPass] = useState(false)
  const [ocultarBanner, setOcultarBanner] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)

  useEffect(() => {
    setOcultarBanner(localStorage.getItem(LS_HIDE_BANNER) === '1')
  }, [])

  // Cerrar menu cuando cambia la ruta.
  useEffect(() => {
    setMenuAbierto(false)
  }, [location.pathname])

  function onLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function pedirCambioPassword() {
    const ok = window.confirm('Queres cambiar tu contrasena?')
    if (ok) setAbrirCambioPass(true)
  }

  function descartarBanner() {
    localStorage.setItem(LS_HIDE_BANNER, '1')
    setOcultarBanner(true)
  }

  const linkBase = 'px-3 py-2 rounded-lg text-sm font-medium transition-colors'
  const linkActive = 'bg-slate-900 text-white'
  const linkIdle = 'text-slate-600 hover:bg-slate-100'

  const esSoloEmpleado =
    (user?.roles.includes('EMPLEADO') ?? false) &&
    !(user?.roles.includes('EDITOR') ?? false) &&
    !(user?.roles.includes('SUPERADMIN') ?? false)

  const mostrarBanner =
    user?.debe_cambiar_password === true && !ocultarBanner

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="font-semibold tracking-tight">
            Gestion Cocina
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {esSoloEmpleado ? (
              <>
                <NavLink
                  to="/inicio"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? linkActive : linkIdle}`
                  }
                >
                  Inicio
                </NavLink>
                <NavLink
                  to="/mi-dashboard"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? linkActive : linkIdle}`
                  }
                >
                  Mi panel
                </NavLink>
                <NavLink
                  to="/grilla"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? linkActive : linkIdle}`
                  }
                >
                  Grilla
                </NavLink>
              </>
            ) : (
              <>
                <NavLink
                  to="/inicio"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? linkActive : linkIdle}`
                  }
                >
                  Inicio
                </NavLink>
                <NavLink
                  to="/grilla"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? linkActive : linkIdle}`
                  }
                >
                  Grilla
                </NavLink>
                <NavLink
                  to="/calendario"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? linkActive : linkIdle}`
                  }
                >
                  Calendario
                </NavLink>
                <NavLink
                  to="/empleados"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? linkActive : linkIdle}`
                  }
                >
                  Empleados
                </NavLink>
                {(user?.roles.includes('SUPERADMIN') ?? false) && (
                  <NavLink
                    to="/usuarios"
                    className={({ isActive }) =>
                      `${linkBase} ${isActive ? linkActive : linkIdle}`
                    }
                  >
                    Usuarios
                  </NavLink>
                )}
                <NavLink
                  to="/limpieza"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? linkActive : linkIdle}`
                  }
                >
                  Limpieza
                </NavLink>
                <NavLink
                  to="/vacaciones"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? linkActive : linkIdle}`
                  }
                >
                  Vacaciones
                </NavLink>
                <NavLink
                  to="/estadisticas"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? linkActive : linkIdle}`
                  }
                >
                  Estadisticas
                </NavLink>
                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? linkActive : linkIdle}`
                  }
                >
                  Settings
                </NavLink>
              </>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-base text-sky-700 font-medium">
              {user?.username}
            </span>
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label="Abrir menu"
              className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-slate-100 text-slate-700"
            >
              {menuAbierto ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
            <button
              onClick={onLogout}
              className="hidden sm:inline-block text-sm px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {menuAbierto && (
        <div className="sm:hidden bg-white border-b border-slate-200">
          <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
            {esSoloEmpleado ? (
              <>
                <MobileNavLink to="/inicio">Inicio</MobileNavLink>
                <MobileNavLink to="/mi-dashboard">Mi panel</MobileNavLink>
                <MobileNavLink to="/grilla">Grilla</MobileNavLink>
              </>
            ) : (
              <>
                <MobileNavLink to="/inicio">Inicio</MobileNavLink>
                <MobileNavLink to="/grilla">Grilla</MobileNavLink>
                <MobileNavLink to="/calendario">Calendario</MobileNavLink>
                <MobileNavLink to="/empleados">Empleados</MobileNavLink>
                {(user?.roles.includes('SUPERADMIN') ?? false) && (
                  <MobileNavLink to="/usuarios">Usuarios</MobileNavLink>
                )}
                <MobileNavLink to="/limpieza">Limpieza</MobileNavLink>
                <MobileNavLink to="/vacaciones">Vacaciones</MobileNavLink>
                <MobileNavLink to="/estadisticas">Estadisticas</MobileNavLink>
                <MobileNavLink to="/settings">Settings</MobileNavLink>
              </>
            )}
            <button
              onClick={onLogout}
              className="text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 mt-1"
            >
              Salir
            </button>
          </nav>
        </div>
      )}

      {mostrarBanner && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <span className="text-amber-900">
              Estas usando una contrasena temporal. Podes cambiarla cuando
              quieras.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAbrirCambioPass(true)}
                className="rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-medium"
              >
                Cambiar ahora
              </button>
              <button
                onClick={descartarBanner}
                className="text-xs text-amber-800 hover:underline"
              >
                Ocultar
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4">
        <Outlet />
      </main>

      <footer className="text-center py-4">
        <a
          href="https://nibalink.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="nibalink.com"
          title="nibalink.com"
          className="inline-block opacity-60 hover:opacity-100 transition-opacity"
        >
          <img
            src="/logo_nibalink.png"
            alt="nibalink"
            className="h-8 w-auto"
          />
        </a>
      </footer>

      {abrirCambioPass && (
        <ModalChangePassword
          onDone={async () => {
            setAbrirCambioPass(false)
            await refresh()
          }}
          onCancelar={() => setAbrirCambioPass(false)}
        />
      )}
    </div>
  )
}


function MobileNavLink({
  to,
  children,
}: {
  to: string
  children: ReactNode
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-lg text-sm font-medium ${
          isActive
            ? 'bg-slate-900 text-white'
            : 'text-slate-700 hover:bg-slate-100'
        }`
      }
    >
      {children}
    </NavLink>
  )
}
