import { useState } from 'react'

interface Props {
  notaInicial?: string | null
  modo: 'crear' | 'modificar'
  empleadoNombre: string
  fechaISO: string
  onConfirmar: (nota: string) => void
  onCancelar: () => void
}

/**
 * Modal para CF (franco protegido).
 * - modo=crear: pide la nota obligatoria.
 * - modo=modificar: muestra la nota actual + doble confirmacion.
 * ASCII puro.
 */
export default function ModalCF({
  notaInicial,
  modo,
  empleadoNombre,
  fechaISO,
  onConfirmar,
  onCancelar,
}: Props) {
  const [nota, setNota] = useState<string>(notaInicial ?? '')
  const [error, setError] = useState<string | null>(null)
  const [dobleConfirmacion, setDobleConfirmacion] = useState(false)

  function confirmar() {
    const limpia = nota.trim()
    if (!limpia) {
      setError('La nota es obligatoria')
      return
    }
    if (modo === 'modificar' && !dobleConfirmacion) {
      setDobleConfirmacion(true)
      return
    }
    onConfirmar(limpia)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <header>
          <h2 className="text-lg font-semibold">
            {modo === 'crear' ? 'Franco protegido' : 'Modificar franco protegido'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {empleadoNombre} - {fechaISO}
          </p>
        </header>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Nota (obligatoria)
          </span>
          <textarea
            rows={3}
            value={nota}
            onChange={(e) => {
              setNota(e.target.value)
              setError(null)
              setDobleConfirmacion(false)
            }}
            placeholder="Ej: Cumpleanos, pidio el franco en enero"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
            readOnly={modo === 'modificar' && !dobleConfirmacion}
          />
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {dobleConfirmacion && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
            <p className="font-medium mb-1">Confirmacion requerida</p>
            <p>
              Vas a modificar un franco protegido. Esta accion queda
              registrada con tu usuario, fecha y hora. Confirma de nuevo
              para continuar.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={confirmar}
            className="w-full sm:w-auto rounded-lg bg-slate-900 text-white px-4 py-3 text-base font-medium active:bg-slate-800"
          >
            {modo === 'crear'
              ? 'Guardar CF'
              : dobleConfirmacion
                ? 'Confirmar y guardar'
                : 'Modificar CF'}
          </button>
          <button
            onClick={onCancelar}
            className="w-full sm:w-auto rounded-lg bg-slate-100 px-4 py-3 text-base font-medium hover:bg-slate-200"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
