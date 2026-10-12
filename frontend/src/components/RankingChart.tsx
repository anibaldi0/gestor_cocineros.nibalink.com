import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { StatsEmpleadoMes } from '../lib/types'

export type MetricaRanking =
  | 'horas_totales'
  | 'horas_extra'
  | 'dias_trabajados'
  | 'dias_franco'
  | 'dias_vacaciones'
  | 'dias_licencia'

export const etiquetaMetrica: Record<MetricaRanking, string> = {
  horas_totales: 'Horas totales',
  horas_extra: 'Horas extra',
  dias_trabajados: 'Dias trabajados',
  dias_franco: 'Francos',
  dias_vacaciones: 'Vacaciones',
  dias_licencia: 'Licencias',
}

const COLOR_POR_METRICA: Record<MetricaRanking, string> = {
  horas_totales: '#0ea5e9', // sky-500
  horas_extra: '#dc2626', // red-600
  dias_trabajados: '#16a34a', // green-600
  dias_franco: '#64748b', // slate-500
  dias_vacaciones: '#eab308', // yellow-500
  dias_licencia: '#7c3aed', // violet-600
}

interface Props {
  empleados: StatsEmpleadoMes[]
  metrica: MetricaRanking
  max?: number // cantidad de barras a mostrar; si no viene, muestra todos
}

interface FilaRanking {
  nombre: string
  valor: number
}

export default function RankingChart({ empleados, metrica, max = 10 }: Props) {
  const datos: FilaRanking[] = useMemo(() => {
    const filas = empleados
      .map((e) => ({
        nombre: `${e.apellido}, ${e.nombre}`,
        valor: Number(e[metrica]) || 0,
      }))
      .filter((f) => f.valor > 0)
      .sort((a, b) => b.valor - a.valor)

    return max > 0 ? filas.slice(0, max) : filas
  }, [empleados, metrica, max])

  const color = COLOR_POR_METRICA[metrica]

  if (datos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-6">
        <p className="text-sm text-slate-500 text-center">
          Sin datos para esta metrica.
        </p>
      </div>
    )
  }

  // Altura adaptativa: 40px por barra + margenes.
  const altura = Math.max(180, datos.length * 40 + 40)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4">
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart
          data={datos}
          layout="vertical"
          margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="nombre"
            width={150}
            tick={{ fontSize: 11 }}
            interval={0}
          />
          <Tooltip
            formatter={(v) => [String(v), etiquetaMetrica[metrica]]}
            labelStyle={{ fontSize: 12 }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          />
          <Bar dataKey="valor" fill={color} radius={[0, 4, 4, 0]}>
            {datos.map((_, i) => (
              <Cell key={i} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
