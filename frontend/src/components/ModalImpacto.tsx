import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { formatFecha } from '../lib/format'
import type { ImpactoCobertura } from '../lib/types'

interface Props {
  anio: number
  empleadoId: number
  empleadoNombre: string
  desde: string
  hasta: string
  onCerrar: () => void
}

export default function ModalImpacto({
  empleadoId,
  empleadoNombre,
  desde,
  hasta,
  onCerrar,
}: Props) {
  const [impacto, setImpacto] = useState<ImpactoCobertura | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      setImpacto(await api.impactoVacaciones(desde, hasta, empleadoId))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, empleadoId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrar])

  const rojos = impacto?.dias.filter((d) => d.estado === 'ROJO').length ?? 0
  const amarillos =
    impacto?.dias.filter((d) => d.estado === 'AMARILLO').length ?? 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-6 space-y-4 max-h-[85vh] overflow-y-auto"
      >
        <header>
          <h2 className="text-lg font-semibold">
            Impacto en cobertura
          </h2>
          <p className="text-sm text-slate-500">
            {empleadoNombre} del {formatFecha(desde)} al {formatFecha(hasta)}.
          </p>
        </header>

        {loading && <p className="text-sm text-slate-500">Calculando...</p>}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {impacto && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-red-100 text-red-800">
                {rojos} dias sin cobertura
              </span>
              <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                {amarillos} dias justos
              </span>
            </div>

            <ul className="bg-slate-50 rounded-lg divide-y divide-slate-200">
              {impacto.dias.map((d) => (
                <li
                  key={d.fecha}
                  className="px-3 py-2 flex items-center gap-3 text-sm"
                >
                  <span
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      d.estado === 'ROJO'
                        ? 'bg-red-500'
                        : d.estado === 'AMARILLO'
                          ? 'bg-amber-400'
                          : 'bg-green-500'
                    }`}
                  />
                  <span className="font-medium text-slate-700 min-w-[80px]">
                    {formatFecha(d.fecha)}
                  </span>
                  <span className="text-slate-600 truncate">
                    {d.mensaje ?? 'Sin problemas'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex justify-end">
          <button
            onClick={onCerrar}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
