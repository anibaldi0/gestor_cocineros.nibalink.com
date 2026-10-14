/** Utilidades de fecha para mostrar en UI. ASCII puro. */

export function fechaHoraCorta(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yy} ${hh}:${mi}`
}

export function fechaHoraRelativa(iso: string | null): string {
  if (!iso) return 'Nunca'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  const ahora = Date.now()
  const diff = ahora - d.getTime()
  const seg = Math.floor(diff / 1000)
  const min = Math.floor(seg / 60)
  const hr = Math.floor(min / 60)
  const dia = Math.floor(hr / 24)

  if (seg < 60) return 'Recien'
  if (min < 60) return `Hace ${min} min`
  if (hr < 24) return `Hace ${hr} h`
  if (dia < 7) return `Hace ${dia} d`
  return fechaHoraCorta(iso)
}
