/** Utilidades de formato del front. ASCII puro. */

/** Formatea un DNI (string de digitos) como "25.354.223". */
export function formatDNI(dni: string | null | undefined): string {
  if (!dni) return '-'
  const d = dni.replace(/\D/g, '')
  if (d.length === 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length === 7) return `${d.slice(0, 1)}.${d.slice(1, 4)}.${d.slice(4)}`
  return d
}

/** Devuelve solo los digitos de un string. */
export function soloDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

/** Formatea fecha ISO (YYYY-MM-DD) como DD/MM/YYYY. */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '-'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const [, y, mo, d] = m
  return `${d}/${mo}/${y}`
}

/** Toma 8 digitos DDMMAAAA y devuelve ISO YYYY-MM-DD o null. */
export function compactoAIso(compacto: string): string | null {
  const d = soloDigitos(compacto)
  if (d.length !== 8) return null
  const dia = Number(d.slice(0, 2))
  const mes = Number(d.slice(2, 4))
  const anio = Number(d.slice(4, 8))
  if (dia < 1 || dia > 31) return null
  if (mes < 1 || mes > 12) return null
  if (anio < 1900 || anio > 2100) return null
  const dt = new Date(anio, mes - 1, dia)
  if (
    dt.getFullYear() !== anio ||
    dt.getMonth() !== mes - 1 ||
    dt.getDate() !== dia
  ) {
    return null
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

/** Muestra 8 digitos como DD/MM/AAAA mientras se tipea. */
export function formatearMientrasTipea(compacto: string): string {
  const d = soloDigitos(compacto).slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/** Toma ISO YYYY-MM-DD y devuelve los 8 digitos DDMMAAAA. */
export function isoACompacto(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return ''
  const [, y, mo, d] = m
  return `${d}${mo}${y}`
}
