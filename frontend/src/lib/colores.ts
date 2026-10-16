import type { EstadoTurno, TipoDiaOperativo } from './types'

/** Color del encabezado de columna segun tipo de dia operativo. */
export const colorTipoDia: Record<TipoDiaOperativo, string> = {
  DIA_LABORAL_CON_COLEGIO: 'bg-slate-100 text-slate-700',
  DIA_LABORAL_SIN_COLEGIO: 'bg-amber-100 text-amber-800',
  FINDE_FERIADO: 'bg-sky-100 text-sky-800',
}

/**
 * Color del encabezado de columna, priorizando feriado > finde > laboral.
 * ASCII puro.
 */
export function colorEncabezadoDia(d: {
  es_feriado: boolean
  es_fin_de_semana: boolean
}): string {
  if (d.es_feriado) return 'bg-red-200 text-red-900'
  if (d.es_fin_de_semana) return 'bg-slate-300 text-slate-800'
  return 'bg-white text-slate-700'
}

/**
 * Color de la celda VACIA del cuerpo, por tipo de dia.
 * Tonos mas suaves que el encabezado para que el texto sea legible.
 */
export function colorCeldaVacia(d: {
  es_feriado: boolean
  es_fin_de_semana: boolean
}): string {
  if (d.es_feriado) return 'bg-red-100'
  if (d.es_fin_de_semana) return 'bg-slate-200'
  return 'bg-white'
}

/** Fondo de la celda segun estado del turno. TRABAJO hereda del dia. */
export const colorEstado: Record<EstadoTurno, string> = {
  TRABAJO: '',
  FRANCO: 'bg-sky-100 text-sky-800',
  VACACIONES: 'bg-yellow-100 text-yellow-900',
  LICENCIA_MEDICA: 'bg-amber-700 text-white',
  ART: 'bg-blue-500 text-white',
  LICENCIA_ESPECIAL: 'bg-violet-100 text-violet-800',
  AUSENCIA_INJUSTIFICADA: 'bg-red-100 text-red-800',
}

/** Etiqueta corta segun estado (para mostrar en la celda). */
export const etiquetaEstado: Record<EstadoTurno, string> = {
  TRABAJO: '',
  FRANCO: 'F',
  VACACIONES: 'V',
  LICENCIA_MEDICA: 'LM',
  ART: 'ART',
  LICENCIA_ESPECIAL: 'LE',
  AUSENCIA_INJUSTIFICADA: 'AI',
}

/** Texto legible del estado para dropdowns. */
export const nombreEstado: Record<EstadoTurno, string> = {
  TRABAJO: 'Trabajo',
  FRANCO: 'Franco',
  VACACIONES: 'Vacaciones',
  LICENCIA_MEDICA: 'Licencia medica',
  ART: 'ART',
  LICENCIA_ESPECIAL: 'Licencia especial',
  AUSENCIA_INJUSTIFICADA: 'Ausencia injustificada',
}


/** Fondo de una celda que tiene horas extra cargadas. */
export const colorHorasExtra = 'bg-red-200 text-red-900'


/** Colores de la pastilla M/T (fondo solido, texto blanco, negrita). */
export const colorTurnoDia: Record<'M' | 'T', string> = {
  M: 'bg-amber-600 text-white font-bold',
  T: 'bg-sky-600 text-white font-bold',
}
