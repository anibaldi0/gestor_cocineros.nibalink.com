export type Rol = 'SUPERADMIN' | 'EDITOR' | 'EMPLEADO'

export type TipoDiaOperativo =
  | 'DIA_LABORAL_CON_COLEGIO'
  | 'DIA_LABORAL_SIN_COLEGIO'
  | 'FINDE_FERIADO'

export type ContextoFranja = 'LABORAL' | 'FINDE' | 'FERIADO'

export type EstadoTurno =
  | 'TRABAJO'
  | 'FRANCO'
  | 'VACACIONES'
  | 'LICENCIA_MEDICA'
  | 'ART'
  | 'LICENCIA_ESPECIAL'
  | 'AUSENCIA_INJUSTIFICADA'

export interface User {
  id: number
  username: string
  empleado_id: number | null
  activo: boolean
  debe_cambiar_password: boolean
  fecha_creacion: string
  roles: Rol[]
  modo_activo: Rol | null
}

export interface EmpleadoUsuario {
  id: number
  username: string
  activo: boolean
  debe_cambiar_password: boolean
}

export interface Empleado {
  id: number
  nombre: string
  apellido: string
  dni: string
  fecha_nacimiento: string | null
  telefono: string | null
  fecha_ingreso: string
  tipo_contrato: string | null
  horas_semana_max: number
  observaciones: string | null
  activo: boolean
  fecha_baja: string | null
  usuario: EmpleadoUsuario | null
}

export interface EmpleadoCreate {
  nombre: string
  apellido: string
  dni: string
  fecha_ingreso: string
  fecha_nacimiento?: string | null
  telefono?: string | null
  tipo_contrato?: string | null
  horas_semana_max?: number
  observaciones?: string | null
}

export interface EventoDia {
  id: number
  codigo: string
  nombre: string
  color_hex: string
  genera_extra_100: boolean
}

export interface DiaGrilla {
  fecha: string
  dia_semana: number
  nombre_dia: string
  tipo_dia_operativo: TipoDiaOperativo
  es_fin_de_semana: boolean
  es_feriado: boolean
  cierra_colegio: boolean
  color_hex: string | null
  eventos: EventoDia[]
}

export interface EmpleadoGrilla {
  id: number
  nombre: string
  apellido: string
  activo: boolean
  horas_semana_max: number
}

export interface TurnoGrilla {
  id: number
  empleado_id: number
  fecha: string
  franja_id: number | null
  franja_nombre: string | null
  codigo_corto: string | null
  hora_inicio: string | null
  hora_fin: string | null
  estado: EstadoTurno
  horas: number
  horas_extra: number
  es_franco_protegido: boolean
  nota: string | null
}

export interface AsignacionLimpiezaGrilla {
  id: number
  empleado_id: number
  fecha: string
  tipo_tarea_id: number
  tipo_tarea_codigo: string
  tipo_tarea_nombre: string
  tipo_tarea_color: string
}

export interface GrillaMes {
  anio: number
  mes: number
  estado_periodo: EstadoPeriodoGrilla
  dias: DiaGrilla[]
  empleados: EmpleadoGrilla[]
  turnos: TurnoGrilla[]
  cobertura: CoberturaDia[]
  alertas: AlertaDia[]
  estado_por_dia: EstadoDia[]
  limpieza: AsignacionLimpiezaGrilla[]
}

export interface TurnoUpsert {
  empleado_id: number
  fecha: string
  estado: EstadoTurno
  franja_id: number | null
  horas: number
  horas_extra: number
  es_franco_protegido: boolean
  nota: string | null
}

export interface Franja {
  id: number
  nombre: string
  hora_inicio: string
  hora_fin: string
  horas: number
  codigo_corto: string | null
  contexto: ContextoFranja | null
  activa: boolean
  orden: number
}

export interface UsuarioDetalle {
  id: number
  username: string
  empleado_id: number | null
  activo: boolean
  debe_cambiar_password: boolean
  fecha_creacion: string
  roles: Rol[]
  empleado_nombre: string | null
}

export interface UsuarioCreate {
  username: string
  rol: Rol
  empleado_id: number | null
  password?: string | null
}

export interface UsuarioCreateResponse extends UsuarioDetalle {
  password_autogenerada: boolean
  password_temporal: string | null
}

export interface UsuarioUpdate {
  username?: string
  rol?: Rol
  empleado_id?: number | null
  activo?: boolean
}

export interface ResetPasswordResponse {
  usuario_id: number
  username: string
  password_temporal: string
  debe_cambiar_password: boolean
}

export type EstadoCobertura = 'CUBIERTO_OK' | 'CUBIERTO_JUSTO' | 'HUECO'
export type NivelAlerta = 'AMARILLO' | 'ROJO'
export type EstadoDiaVisual = 'OK' | 'AMARILLO' | 'ROJO'

export interface CoberturaDia {
  fecha: string
  franja_id: number
  franja_nombre: string
  codigo_corto: string | null
  contexto: ContextoFranja
  actual: number
  minima: number
  ideal: number
  estado: EstadoCobertura
}

export interface AlertaDia {
  fecha: string
  franja_id: number
  franja_nombre: string
  nivel: NivelAlerta
  mensaje: string
}

export interface EstadoDia {
  fecha: string
  estado: EstadoDiaVisual
  alertas: number
}

export interface ReglaCobertura {
  id: number
  tipo_dia_operativo: TipoDiaOperativo
  franja_id: number
  franja_nombre: string
  franja_codigo_corto: string | null
  franja_contexto: ContextoFranja | null
  cantidad_minima: number
  cantidad_ideal: number
  activo: boolean
}

export interface Configuracion {
  clave: string
  valor: string
  tipo: 'INT' | 'FLOAT' | 'STRING' | 'BOOL'
  descripcion: string | null
  categoria: string | null
}

// ---- Dashboard del empleado ----
export interface EmpleadoInfo {
  id: number
  nombre: string
  apellido: string
  fecha_ingreso: string
  horas_semana_max: number
}

export interface StatsMes {
  dias_trabajados: number
  francos: number
  vacaciones_tomadas: number
  licencias: number
  horas_totales: number
  horas_extra: number
  dias_con_he: number
  horas_trabajadas_mas_he: number
  saldo_horas: number
}

export interface FrancoMes {
  fecha: string
  es_franco_protegido: boolean
  nota: string | null
}

export interface FeriadoTrabajado {
  fecha: string
  nombre_evento: string
  estado: EstadoTurno
  horas: number
  codigo_corto: string | null
}

export interface TurnoMes {
  fecha: string
  estado: EstadoTurno
  horas: number
  horas_extra: number
  franja_nombre: string | null
  codigo_corto: string | null
  hora_inicio: string | null
  hora_fin: string | null
  es_franco_protegido: boolean
  nota: string | null
}

export interface DashboardEmpleado {
  empleado: EmpleadoInfo
  anio: number
  mes: number
  stats: StatsMes
  francos: FrancoMes[]
  feriados_trabajados: FeriadoTrabajado[]
  turnos: TurnoMes[]
  limpieza: LimpiezaEmpleado[]
}

// ---- Vacaciones ----
export type ModoConteo = 'CORRIDOS' | 'HABILES'
export type EstadoVacacionesAnuales = 'ABIERTA' | 'CERRADA'

export interface EmpleadoVacaciones {
  empleado_id: number
  nombre: string
  apellido: string
  dni: string
  anio: number
  dias_totales: number | null
  modo_conteo: ModoConteo | null
  estado: EstadoVacacionesAnuales | null
  dias_arrastrados: number
  dias_tomados: number
  dias_pendientes: number | null
}

export interface ListadoVacaciones {
  anio: number
  empleados: EmpleadoVacaciones[]
}

export interface VacacionesAnuales {
  anio: number
  empleado_id: number
  dias_totales: number
  modo_conteo: ModoConteo
  estado: EstadoVacacionesAnuales
  dias_arrastrados: number
  observacion: string | null
  fecha_carga: string
  dias_tomados: number
  dias_pendientes: number
}

export interface NovedadVacaciones {
  id: number
  empleado_id: number
  anio_vacacional: number
  desde: string
  hasta: string
  dias_solicitados: number
  dias_computados: number
  observacion: string | null
  estado: 'ACTIVA' | 'FINALIZADA' | 'CANCELADA'
  fecha_creacion: string
}

export interface DetalleVacaciones {
  empleado: {
    id: number
    nombre: string
    apellido: string
    dni: string
  }
  anio: number
  anual: VacacionesAnuales | null
  novedades: NovedadVacaciones[]
}

export interface ImpactoDia {
  fecha: string
  estado: 'OK' | 'AMARILLO' | 'ROJO'
  alertas: number
  mensaje: string | null
}

export interface ImpactoCobertura {
  desde: string
  hasta: string
  dias: ImpactoDia[]
}

// ---- Estadisticas ----
export interface StatsEmpleadoMes {
  empleado_id: number
  nombre: string
  apellido: string
  dni: string
  horas_semana_max: number
  dias_trabajados: number
  dias_franco: number
  dias_vacaciones: number
  dias_licencia: number
  dias_ausencia: number
  horas_trabajadas: number
  horas_extra: number
  horas_totales: number
  dias_con_he: number
}

export interface StatsAgregadasMes {
  dias_totales_mes: number
  dias_con_alerta_roja: number
  dias_con_alerta_amarilla: number
  empleados_activos: number
  horas_totales_plantel: number
  horas_extra_totales: number
}

export interface StatsMes {
  anio: number
  mes: number
  empleados: StatsEmpleadoMes[]
  agregadas: StatsAgregadasMes
}

export interface StatsMesResumen {
  mes: number
  agregadas: StatsAgregadasMes
}

export interface StatsAnio {
  anio: number
  empleados: StatsEmpleadoMes[]
  agregadas: StatsAgregadasMes
  por_mes: StatsMesResumen[]
}

export interface StatsAnioResumen {
  anio: number
  agregadas: StatsAgregadasMes
}

export interface StatsHistorico {
  anios: StatsAnioResumen[]
  total_empleados_distintos: number
}

// ---- Publicacion ----
export type EstadoPeriodoGrilla = 'BORRADOR' | 'PUBLICADO'

export interface PeriodoGrilla {
  anio: number
  mes: number
  estado: EstadoPeriodoGrilla
  fecha_publicacion: string | null
  publicado_por_username: string | null
}

// ---- Calendario ----
export interface TipoEvento {
  id: number
  codigo: string
  nombre: string
  afecta_colegio: boolean
  afecta_hogar: boolean
  genera_extra_100: boolean
  color_hex: string
  fuerza_tipo_dia_operativo: TipoDiaOperativo | null
  activo: boolean
}

export interface Evento {
  id: number
  tipo_evento_id: number
  tipo_evento_codigo: string
  tipo_evento_nombre: string
  tipo_evento_color: string
  nombre: string
  desde: string
  hasta: string
  anio: number
  observacion: string | null
  fecha_creacion: string
}

export interface EventoCreate {
  tipo_evento_id: number
  nombre: string
  desde: string
  hasta: string
  observacion?: string | null
}

export interface EventoUpdate {
  tipo_evento_id?: number
  nombre?: string
  desde?: string
  hasta?: string
  observacion?: string | null
}

// ---- Limpieza ----
export interface TipoTareaLimpieza {
  id: number
  codigo: string
  nombre: string
  color_hex: string
  activo: boolean
}

export interface AsignacionLimpieza {
  id: number
  empleado_id: number
  empleado_nombre: string
  fecha: string
  tipo_tarea_id: number
  tipo_tarea_codigo: string
  tipo_tarea_nombre: string
  tipo_tarea_color: string
  observacion: string | null
}

export interface MesLimpieza {
  anio: number
  mes: number
  tipos: TipoTareaLimpieza[]
  asignaciones: AsignacionLimpieza[]
}

export interface LimpiezaEmpleado {
  fecha: string
  tipo_tarea_id: number
  tipo_tarea_codigo: string
  tipo_tarea_nombre: string
  tipo_tarea_color: string
  observacion: string | null
}
