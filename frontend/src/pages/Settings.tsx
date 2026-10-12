import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Configuracion, ReglaCobertura } from '../lib/types'
import { useAuth } from '../lib/use-auth'

const nombreTipoDia: Record<string, string> = {
  DIA_LABORAL_CON_COLEGIO: 'Laboral con colegio',
  DIA_LABORAL_SIN_COLEGIO: 'Laboral sin colegio',
  FINDE_FERIADO: 'Finde / feriado',
}

export default function Settings() {
  const { user } = useAuth()
  const esSuper = user?.roles.includes('SUPERADMIN') ?? false

  const [reglas, setReglas] = useState<ReglaCobertura[]>([])
  const [configs, setConfigs] = useState<Configuracion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const [r, c] = await Promise.all([
        api.reglasCobertura(),
        api.configuracion(),
      ])
      setReglas(r)
      setConfigs(c)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  async function guardarRegla(
    id: number,
    minima: number,
    ideal: number,
  ) {
    try {
      await api.actualizarReglaCobertura(id, {
        cantidad_minima: minima,
        cantidad_ideal: ideal,
      })
      await cargar()
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Error')
    }
  }

  async function guardarConfig(clave: string, valor: string) {
    try {
      await api.actualizarConfiguracion(clave, valor)
      await cargar()
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Error')
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Cargando...</p>
  if (error)
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {error}
      </p>
    )

  const configsPorCat = configs.reduce<Record<string, Configuracion[]>>(
    (acc, c) => {
      const k = c.categoria ?? 'otros'
      if (!acc[k]) acc[k] = []
      acc[k].push(c)
      return acc
    },
    {},
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500">
          Reglas de cobertura y umbrales de alertas.
          {!esSuper && ' Solo lectura (superadmin puede editar).'}
        </p>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-medium text-slate-700">
            Reglas de cobertura
          </h2>
          <p className="text-xs text-slate-500">
            Minimo = cantidad por debajo de la cual es HUECO (rojo).
            Ideal = cantidad que se busca tener.
          </p>
        </header>

        <ul className="divide-y divide-slate-100">
          {reglas.map((r) => (
            <FilaRegla
              key={r.id}
              regla={r}
              editable={esSuper}
              onGuardar={guardarRegla}
            />
          ))}
        </ul>
      </section>

      {Object.entries(configsPorCat).map(([cat, items]) => (
        <section
          key={cat}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
        >
          <header className="px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-medium text-slate-700 capitalize">
              {cat}
            </h2>
          </header>

          <ul className="divide-y divide-slate-100">
            {items.map((c) => (
              <FilaConfig
                key={c.clave}
                config={c}
                editable={esSuper}
                onGuardar={guardarConfig}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

interface FilaReglaProps {
  regla: ReglaCobertura
  editable: boolean
  onGuardar: (id: number, minima: number, ideal: number) => void
}

function FilaRegla({ regla, editable, onGuardar }: FilaReglaProps) {
  const [minima, setMinima] = useState(regla.cantidad_minima)
  const [ideal, setIdeal] = useState(regla.cantidad_ideal)

  useEffect(() => {
    setMinima(regla.cantidad_minima)
    setIdeal(regla.cantidad_ideal)
  }, [regla.cantidad_minima, regla.cantidad_ideal])

  const cambio =
    minima !== regla.cantidad_minima || ideal !== regla.cantidad_ideal
  const invalido = ideal < minima

  return (
    <li className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {regla.franja_nombre}
        </p>
        <p className="text-xs text-slate-500">
          {nombreTipoDia[regla.tipo_dia_operativo] ?? regla.tipo_dia_operativo}
          {' '}
          {regla.franja_codigo_corto && `[${regla.franja_codigo_corto}]`}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-slate-600">
          Min
          <input
            type="number"
            min={0}
            max={50}
            value={minima}
            onChange={(e) => setMinima(Number(e.target.value))}
            disabled={!editable}
            className="w-16 rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          Ideal
          <input
            type="number"
            min={0}
            max={50}
            value={ideal}
            onChange={(e) => setIdeal(Number(e.target.value))}
            disabled={!editable}
            className="w-16 rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50"
          />
        </label>

        {editable && (
          <button
            onClick={() => onGuardar(regla.id, minima, ideal)}
            disabled={!cambio || invalido}
            className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            Guardar
          </button>
        )}
      </div>
    </li>
  )
}

interface FilaConfigProps {
  config: Configuracion
  editable: boolean
  onGuardar: (clave: string, valor: string) => void
}

function FilaConfig({ config, editable, onGuardar }: FilaConfigProps) {
  const [valor, setValor] = useState(config.valor)

  useEffect(() => {
    setValor(config.valor)
  }, [config.valor])

  const cambio = valor !== config.valor

  return (
    <li className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs text-slate-500">{config.clave}</p>
        <p className="text-sm text-slate-700">
          {config.descripcion ?? config.clave}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          disabled={!editable}
          className="w-24 rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50"
        />
        {editable && (
          <button
            onClick={() => onGuardar(config.clave, valor)}
            disabled={!cambio}
            className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            Guardar
          </button>
        )}
      </div>
    </li>
  )
}
