import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/use-auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Empleados from './pages/Empleados'
import EmpleadoNuevo from './pages/EmpleadoNuevo'
import EmpleadoDetalle from './pages/EmpleadoDetalle'
import Grilla from './pages/Grilla'
import Limpieza from './pages/Limpieza'
import Inicio from './pages/Inicio'
import GrillaImprimir from './pages/GrillaImprimir'
import MiDashboard from './pages/MiDashboard'
import Usuarios from './pages/Usuarios'
import UsuarioNuevo from './pages/UsuarioNuevo'
import UsuarioDetalle from './pages/UsuarioDetalle'
import Settings from './pages/Settings'
import Calendario from './pages/Calendario'
import Estadisticas from './pages/Estadisticas'
import Vacaciones from './pages/Vacaciones'
import VacacionesDetalle from './pages/VacacionesDetalle'
import type { ReactNode } from 'react'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-sm text-slate-500">Cargando...</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RedirectIfAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

function Root() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to="/inicio" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <RedirectIfAuth>
                <Login />
              </RedirectIfAuth>
            }
          />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Root />} />
            <Route path="/empleados" element={<Empleados />} />
            <Route path="/empleados/nuevo" element={<EmpleadoNuevo />} />
            <Route path="/empleados/:id" element={<EmpleadoDetalle />} />
            <Route path="/inicio" element={<Inicio />} />
            <Route path="/grilla" element={<Grilla />} />
            <Route path="/limpieza" element={<Limpieza />} />
            <Route path="/grilla/imprimir" element={<GrillaImprimir />} />
            <Route path="/mi-dashboard" element={<MiDashboard />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/usuarios/nuevo" element={<UsuarioNuevo />} />
            <Route path="/usuarios/:id" element={<UsuarioDetalle />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/estadisticas" element={<Estadisticas />} />
            <Route path="/vacaciones" element={<Vacaciones />} />
            <Route path="/vacaciones/:anio/:empleadoId" element={<VacacionesDetalle />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
