import type { ErrorDetalle } from '../lib/api'

interface ImpactoDia {
  fecha: string
  turnos_cargados: number
  horas_totales: number
  horas_extra_estimadas: number
  cobertura_minima: number
  exceso_personal: number
  mensaje: string
}

interface Props {
  nombreEvento: string
  detalle: ErrorDetalle
  procesando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

export default function ModalImpactoEvento({
  nombreEvento,
  detalle,
  procesando,
  onConfirmar,
  onCancelar,
}: Props) {
  const impacto = detalle.impacto as
    | {
        dias: ImpactoDia[]
        total_horas_extra_estimadas: number
        total_exceso_personal: number
      }
    | undefined

  if (!impacto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-amber-300 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <header>
          <h2 className="text-lg font-semibold text-amber-800">
            Este evento afecta la grilla
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Vas a crear <strong>{nombreEvento}</strong>. Los siguientes dias
            ya tienen turnos cargados que pasarian a pagarse como horas
            extra al 100%:
          </p>
        </header>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 space-y-1">
          <p>
            <strong>{impacto.total_horas_extra_estimadas}h</strong> extra
            estimadas al 100%.
          </p>
          {impacto.total_exceso_personal > 0 && (
            <p>
              <strong>{impacto.total_exceso_personal}</strong> persona(s) de
              exceso segun la guardia minima.
            </p>
          )}
        </div>

        <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
          {impacto.dias.map((d) => (
            <li key={d.fecha} className="px-3 py-2 text-sm">
              <div className="font-medium text-slate-800">{d.fecha}</div>
              <div className="text-xs text-slate-600">{d.mensaje}</div>
            </li>
          ))}
        </ul>

        <p className="text-xs text-slate-500">
          Podes guardar igual y ajustar la grilla despues. Tambien podes
          cancelar, ajustar los turnos primero y volver a cargar el evento.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={onConfirmar}
            disabled={procesando}
            className="w-full sm:w-auto rounded-lg bg-amber-600 text-white px-4 py-3 text-base font-medium disabled:opacity-50"
          >
            {procesando ? 'Guardando...' : 'Guardar de todos modos'}
          </button>
          <button
            onClick={onCancelar}
            disabled={procesando}
            className="w-full sm:w-auto rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
          >
            Cancelar y ajustar primero
          </button>
        </div>
      </div>
    </div>
  )
}
