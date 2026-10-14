import type {
  Configuracion,
  DashboardEmpleado,
  AsignacionLimpieza,
  DetalleVacaciones,
  Evento,
  EventoCreate,
  EventoUpdate,
  ImpactoCobertura,
  ListadoVacaciones,
  MesLimpieza,
  Franja,
  GrillaMes,
  ModoConteo,
  NovedadVacaciones,
  PeriodoGrilla,
  LoginsUsuario,
  ReglaCobertura,
  ResetPasswordResponse,
  ResumenLogin,
  Rol,
  StatsAnio,
  StatsHistorico,
  TipoEvento,
  TipoTareaLimpieza,
  StatsMes,
  TurnoGrilla,
  TurnoUpsert,
  UsuarioCreate,
  UsuarioCreateResponse,
  UsuarioDetalle,
  UsuarioUpdate,
  VacacionesAnuales,
} from './types'

const API_BASE = '/api/v1'

export interface ErrorDetalle {
  codigo?: string
  mensaje?: string
  empleado_existente?: unknown
  [k: string]: unknown
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: ErrorDetalle,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function getToken(): string | null {
  return localStorage.getItem('cocina_token')
}

export function setToken(t: string | null): void {
  if (t) localStorage.setItem('cocina_token', t)
  else localStorage.removeItem('cocina_token')
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, ...init } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  }
  if (!skipAuth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string | ErrorDetalle
    }
    const rawDetail = body.detail
    let message: string
    let detail: ErrorDetalle | undefined
    if (typeof rawDetail === 'string') {
      message = rawDetail
    } else if (rawDetail && typeof rawDetail === 'object') {
      detail = rawDetail as ErrorDetalle
      message = detail.mensaje || res.statusText
    } else {
      message = res.statusText
    }
    throw new ApiError(res.status, message, detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export interface MeResponse {
  id: number
  username: string
  empleado_id: number | null
  activo: boolean
  debe_cambiar_password: boolean
  fecha_creacion: string
  roles: Rol[]
  modo_activo: Rol | null
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  login: (username: string, password: string) =>
    request<{
      access_token: string
      token_type: string
      debe_cambiar_password: boolean
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuth: true,
    }),

  me: () => request<MeResponse>('/auth/me'),

  franjas: () => request<Franja[]>('/franjas'),

  grillaMes: (anio: number, mes: number) =>
    request<GrillaMes>(`/grilla/mes?anio=${anio}&mes=${mes}`),

  upsertTurno: (payload: TurnoUpsert) =>
    request<TurnoGrilla>('/turnos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  borrarTurno: (empleadoId: number, fecha: string) =>
    request<void>(`/turnos/${empleadoId}/${fecha}`, { method: 'DELETE' }),

  usuarios: (params?: { activo?: boolean; q?: string }) => {
    const sp = new URLSearchParams()
    if (params?.activo !== undefined) sp.set('activo', String(params.activo))
    if (params?.q) sp.set('q', params.q)
    const qs = sp.toString()
    return request<UsuarioDetalle[]>(`/usuarios${qs ? `?${qs}` : ''}`)
  },

  usuario: (id: number) =>
    request<UsuarioDetalle>(`/usuarios/${id}`),

  crearUsuario: (payload: UsuarioCreate) =>
    request<UsuarioCreateResponse>('/usuarios', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  actualizarUsuario: (id: number, payload: UsuarioUpdate) =>
    request<UsuarioDetalle>(`/usuarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  desactivarUsuario: (id: number) =>
    request<void>(`/usuarios/${id}`, { method: 'DELETE' }),

  resetPasswordUsuario: (id: number, password?: string) =>
    request<ResetPasswordResponse>(`/usuarios/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password: password ?? null }),
    }),

  changePassword: (password_actual: string, password_nueva: string) =>
    request<{ status: string; mensaje: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ password_actual, password_nueva }),
    }),

  reglasCobertura: () =>
    request<ReglaCobertura[]>('/settings/reglas-cobertura'),

  actualizarReglaCobertura: (
    id: number,
    payload: { cantidad_minima?: number; cantidad_ideal?: number; activo?: boolean },
  ) =>
    request<ReglaCobertura>(`/settings/reglas-cobertura/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  configuracion: () =>
    request<Configuracion[]>('/settings/configuracion'),

  actualizarConfiguracion: (clave: string, valor: string) =>
    request<Configuracion>(`/settings/configuracion/${clave}`, {
      method: 'PATCH',
      body: JSON.stringify({ valor }),
    }),

  miDashboard: (anio?: number, mes?: number) => {
    const sp = new URLSearchParams()
    if (anio) sp.set('anio', String(anio))
    if (mes) sp.set('mes', String(mes))
    const qs = sp.toString()
    return request<DashboardEmpleado>(`/me/dashboard${qs ? `?${qs}` : ''}`)
  },

  crearUsuarioDeEmpleado: (
    empleadoId: number,
    payload: { username: string; password?: string | null },
  ) =>
    request<UsuarioCreateResponse>(`/empleados/${empleadoId}/usuario`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resetPasswordDeEmpleado: (empleadoId: number, password?: string) =>
    request<ResetPasswordResponse>(
      `/empleados/${empleadoId}/usuario/reset-password`,
      {
        method: 'POST',
        body: JSON.stringify({ password: password ?? null }),
      },
    ),

  actualizarUsuarioDeEmpleado: (
    empleadoId: number,
    payload: { username?: string; activo?: boolean },
  ) =>
    request<UsuarioDetalle>(`/empleados/${empleadoId}/usuario`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  listadoVacaciones: (anio: number) =>
    request<ListadoVacaciones>(`/vacaciones/${anio}`),

  detalleVacaciones: (anio: number, empleadoId: number) =>
    request<DetalleVacaciones>(`/vacaciones/${anio}/${empleadoId}`),

  cargarSaldoVacaciones: (
    anio: number,
    empleadoId: number,
    payload: { dias_totales: number; modo_conteo: ModoConteo; observacion?: string | null },
  ) =>
    request<VacacionesAnuales>(`/vacaciones/${anio}/${empleadoId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  editarSaldoVacaciones: (
    anio: number,
    empleadoId: number,
    payload: {
      dias_totales?: number
      modo_conteo?: ModoConteo
      observacion?: string | null
      dias_arrastrados?: number
    },
  ) =>
    request<VacacionesAnuales>(`/vacaciones/${anio}/${empleadoId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  crearNovedadVacaciones: (
    payload: {
      empleado_id: number
      anio_vacacional: number
      desde: string
      dias: number
      observacion?: string | null
    },
    confirmarExceso: boolean = false,
  ) =>
    request<NovedadVacaciones>(
      `/vacaciones/novedades${confirmarExceso ? '?confirmar_exceso=true' : ''}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  editarNovedadVacaciones: (
    novedadId: number,
    payload: {
      desde?: string
      dias?: number
      observacion?: string | null
    },
    confirmarExceso: boolean = false,
  ) =>
    request<NovedadVacaciones>(
      `/vacaciones/novedades/${novedadId}${confirmarExceso ? '?confirmar_exceso=true' : ''}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),

  eliminarNovedadVacaciones: (novedadId: number) =>
    request<NovedadVacaciones>(`/vacaciones/novedades/${novedadId}`, {
      method: 'DELETE',
    }),

  impactoVacaciones: (desde: string, hasta: string, empleadoId: number) => {
    const sp = new URLSearchParams({ desde, hasta, empleado_id: String(empleadoId) })
    return request<ImpactoCobertura>(`/vacaciones/impacto/simular?${sp}`)
  },

  cerrarAnioVacaciones: (
    anio: number,
    items: { empleado_id: number; decision: 'PERDER' | 'ARRASTRAR' | 'COMPENSAR' }[],
  ) =>
    request<{ anio: number; procesados: number; detalle: string[] }>(
      `/vacaciones/${anio}/cerrar`,
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      },
    ),

  statsMes: (anio: number, mes: number) =>
    request<StatsMes>(`/estadisticas/mes?anio=${anio}&mes=${mes}`),

  statsMesCsvUrl: (anio: number, mes: number) =>
    `/api/v1/estadisticas/mes.csv?anio=${anio}&mes=${mes}`,

  statsAnio: (anio: number) =>
    request<StatsAnio>(`/estadisticas/anio?anio=${anio}`),

  statsAnioCsvUrl: (anio: number) =>
    `/api/v1/estadisticas/anio.csv?anio=${anio}`,

  statsHistorico: () =>
    request<StatsHistorico>('/estadisticas/historico'),

  estadoPublicacion: (anio: number, mes: number) =>
    request<PeriodoGrilla>(
      `/grilla/publicacion?anio=${anio}&mes=${mes}`,
    ),

  publicarGrilla: (anio: number, mes: number) =>
    request<PeriodoGrilla>(
      `/grilla/publicacion/publicar?anio=${anio}&mes=${mes}`,
      { method: 'POST' },
    ),

  reabrirGrilla: (anio: number, mes: number) =>
    request<PeriodoGrilla>(
      `/grilla/publicacion/reabrir?anio=${anio}&mes=${mes}`,
      { method: 'POST' },
    ),

  tiposEvento: () =>
    request<TipoEvento[]>('/calendario/tipos'),

  listarEventos: (anio: number) =>
    request<Evento[]>(`/calendario/eventos?anio=${anio}`),

  crearEvento: (payload: EventoCreate, confirmarImpacto: boolean = false) =>
    request<Evento>(
      `/calendario/eventos${confirmarImpacto ? '?confirmar_impacto=true' : ''}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  actualizarEvento: (id: number, payload: EventoUpdate) =>
    request<Evento>(`/calendario/eventos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  eliminarEvento: (id: number) =>
    request<void>(`/calendario/eventos/${id}`, { method: 'DELETE' }),

  limpiezaTipos: () =>
    request<TipoTareaLimpieza[]>('/limpieza/tipos'),

  limpiezaMes: (anio: number, mes: number) =>
    request<MesLimpieza>(
      `/limpieza/mes?anio=${anio}&mes=${mes}`,
    ),

  crearAsignacionLimpieza: (payload: {
    empleado_id: number
    fecha: string
    tipo_tarea_id: number
    observacion?: string | null
  }) =>
    request<AsignacionLimpieza>('/limpieza/asignaciones', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  actualizarAsignacionLimpieza: (
    id: number,
    payload: { empleado_id?: number; observacion?: string | null },
  ) =>
    request<AsignacionLimpieza>(`/limpieza/asignaciones/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  eliminarAsignacionLimpieza: (id: number) =>
    request<void>(`/limpieza/asignaciones/${id}`, { method: 'DELETE' }),

  limpiezaAsignacionesPorFecha: (fecha: string) =>
    request<AsignacionLimpieza[]>(
      `/limpieza/asignaciones-por-fecha?fecha=${fecha}`,
    ),

  loginsResumen: () =>
    request<ResumenLogin[]>('/usuarios/logins-resumen'),

  loginsDeUsuario: (id: number) =>
    request<LoginsUsuario>(`/usuarios/${id}/logins`),

  loginsEmpleadoResumen: () =>
    request<ResumenLogin[]>('/empleados/logins-resumen'),

  loginsDeEmpleado: (id: number) =>
    request<LoginsUsuario>(`/empleados/${id}/logins`),
}
