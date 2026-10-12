import { useEffect, useRef, useState } from 'react'
import {
  compactoAIso,
  formatearMientrasTipea,
  isoACompacto,
  soloDigitos,
} from '../lib/format'

interface Props {
  value: string | null
  onChange: (iso: string | null) => void
  label: string
  required?: boolean
  className?: string
}

/**
 * Input de fecha. Dos formas de cargar, sincronizadas:
 *   1) Input numerico: se tipean 8 digitos DDMMAAAA y se formatea solo.
 *   2) Date picker nativo: se elige del calendario del sistema operativo.
 *
 * onChange recibe siempre ISO (YYYY-MM-DD) o null.
 * ASCII puro.
 */
export default function FechaInput({
  value,
  onChange,
  label,
  required = false,
  className = '',
}: Props) {
  const [compacto, setCompacto] = useState<string>(() => isoACompacto(value))
  const [error, setError] = useState<string | null>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCompacto(isoACompacto(value))
  }, [value])

  function handleTextChange(raw: string) {
    const solo = soloDigitos(raw).slice(0, 8)
    setCompacto(solo)
    if (solo.length === 0) {
      setError(null)
      onChange(null)
      return
    }
    if (solo.length < 8) {
      setError(null)
      return
    }
    const iso = compactoAIso(solo)
    if (!iso) {
      setError('Fecha invalida')
      return
    }
    setError(null)
    onChange(iso)
  }

  function handleDatePicker(iso: string) {
    if (!iso) {
      setCompacto('')
      setError(null)
      onChange(null)
      return
    }
    setCompacto(isoACompacto(iso))
    setError(null)
    onChange(iso)
  }

  const visible = formatearMientrasTipea(compacto)
  const isoActual = compacto.length === 8 ? compactoAIso(compacto) : null
  const isoParaDate = isoActual ?? value ?? ''

  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required ? ' *' : ''}
      </span>

      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9/]*"
          autoComplete="off"
          placeholder="DDMMAAAA"
          value={visible}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={() => {
            if (compacto.length === 8 && !compactoAIso(compacto)) {
              setError('Fecha invalida')
            }
          }}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        <button
          type="button"
          onClick={() => {
            const el = dateRef.current
            if (!el) return
            // Abrimos el date picker nativo programaticamente.
            if (typeof el.showPicker === 'function') {
              try {
                el.showPicker()
              } catch {
                el.click()
              }
            } else {
              el.click()
            }
          }}
          title="Elegir del calendario"
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-base hover:bg-slate-50"
          aria-label="Elegir del calendario"
        >
          Cal
        </button>
        <input
          ref={dateRef}
          type="date"
          tabIndex={-1}
          value={isoParaDate}
          onChange={(e) => handleDatePicker(e.target.value)}
          className="sr-only"
          aria-hidden="true"
        />
      </div>

      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : compacto.length === 8 ? (
        <span className="text-xs text-slate-400">Se guarda como: {visible}</span>
      ) : (
        <span className="text-xs text-slate-400">
          Tipea 8 numeros (ej: 11102026) o usa el calendario
        </span>
      )}
    </label>
  )
}
