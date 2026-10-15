import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { formatFecha } from '../lib/format'
import type { AsignacionLimpieza, MesLimpieza } from '../lib/types'

export default function LimpiezaImprimir() {
  const [params] = useSearchParams()
  const anio = Number(params.get('anio') ?? new Date().getFullYear())
  const mes = Number(params.get('mes') ?? new Date().getMonth() + 1)

  const [data, setData] = useState<MesLimpieza | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      setData(await api.limpiezaMes(anio, mes))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes])

  const porTipo = useMemo(() => {
    const map = new Map<number, AsignacionLimpieza[]>()
    if (!data) return map
    for (const a of data.asignaciones) {
      if (!map.has(a.tipo_tarea_id)) map.set(a.tipo_tarea_id, [])
      map.get(a.tipo_tarea_id)!.push(a)
    }
    // Ordenar cada lista por fecha.
    for (const [, arr] of map) {
      arr.sort((x, y) => x.fecha.localeCompare(y.fecha))
    }
    return map
  }, [data])

  if (loading)
    return <p className="p-4 text-sm text-slate-500">Cargando...</p>
  if (error) return <p className="p-4 text-sm text-red-600">{error}</p>
  if (!data) return null

  const estiloImpresion = `
    @page { size: A4 portrait; margin: 15mm; }
    @media print {
      body { background: white !important; }
      .no-print { display: none !important; }
      .page-break { page-break-after: always; break-after: page; }
      .ultima { page-break-after: auto; break-after: auto; }
    }
  `

  const totalPaginas = data.tipos.length

  return (
    <div className="bg-white min-h-screen p-4">
      <style>{estiloImpresion}</style>

      <div className="no-print mb-4 flex flex-wrap gap-2 items-center">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium"
        >
          Imprimir / Guardar PDF
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
        >
          Cerrar
        </button>
        <span className="text-xs text-slate-500">
          Se generan {totalPaginas} paginas (una por tarea). Elegi
          "Guardar como PDF" para archivar.
        </span>
      </div>

      {data.tipos.map((tipo, idx) => {
        const asigs = porTipo.get(tipo.id) ?? []
        const esUltima = idx === totalPaginas - 1
        return (
          <section
            key={tipo.id}
            className={esUltima ? 'ultima' : 'page-break'}
          >
            <header className="mb-4">
              <h1 className="text-2xl font-bold text-slate-900">
                Limpieza de {tipo.nombre}
              </h1>
              <p className="text-sm text-slate-600">
                {mesNombre(mes)} {anio}
              </p>
            </header>

            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-slate-400 px-3 py-2 text-left text-sm font-semibold w-[20%]">
                    Fecha
                  </th>
                  <th className="border border-slate-400 px-3 py-2 text-left text-sm font-semibold w-[45%]">
                    Nombre
                  </th>
                  <th className="border border-slate-400 px-3 py-2 text-left text-sm font-semibold w-[35%]">
                    Firma
                  </th>
                </tr>
              </thead>
              <tbody>
                {asigs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="border border-slate-400 px-3 py-6 text-center text-sm text-slate-500"
                    >
                      Sin asignaciones este mes.
                    </td>
                  </tr>
                ) : (
                  asigs.map((a) => (
                    <tr key={a.id} className="h-16">
                      <td className="border border-slate-400 px-3 py-2 align-top text-sm">
                        {formatFecha(a.fecha)}
                      </td>
                      <td className="border border-slate-400 px-3 py-2 align-top text-sm">
                        {a.empleado_nombre}
                      </td>
                      <td className="border border-slate-400 px-3 py-2 align-top" />
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <p className="mt-6 text-xs text-slate-500">
              Firma del responsable: ______________________________
            </p>
          </section>
        )
      })}
    </div>
  )
}

function mesNombre(m: number): string {
  return (
    [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ][m - 1] ?? String(m)
  )
}
