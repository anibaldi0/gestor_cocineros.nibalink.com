"""Parser de fechas tolerante para inputs del frontend y de curl.

Formatos aceptados:
- ISO:             "2026-10-11"
- Con barras:      "11/10/2026"
- Compacto:        "11102026"        (DDMMYYYY)

Todos devuelven datetime.date. Si el valor es invalido, lanza ValueError.
ASCII puro.
"""

from __future__ import annotations

from datetime import date


ANIO_MIN = 1900
ANIO_MAX = 2100


def _construir(dia: int, mes: int, anio: int) -> date:
    if not (1 <= dia <= 31):
        raise ValueError(f"Dia invalido: {dia}")
    if not (1 <= mes <= 12):
        raise ValueError(f"Mes invalido: {mes}")
    if not (ANIO_MIN <= anio <= ANIO_MAX):
        raise ValueError(f"Anio invalido: {anio}")
    try:
        return date(anio, mes, dia)
    except ValueError as exc:
        raise ValueError(f"Fecha invalida: {dia}/{mes}/{anio}") from exc


def parse_fecha(valor: object) -> date:
    """Convierte lo que venga a date. Acepta date, ISO, DD/MM/YYYY o DDMMYYYY."""
    if isinstance(valor, date):
        return valor
    if not isinstance(valor, str):
        raise ValueError(f"Fecha invalida: {valor!r}")

    s = valor.strip()
    if not s:
        raise ValueError("Fecha vacia")

    # ISO o con barras: hay separadores.
    if "-" in s or "/" in s:
        s2 = s.replace("/", "-")
        partes = s2.split("-")
        if len(partes) != 3:
            raise ValueError(f"Formato de fecha no reconocido: {valor!r}")
        # Detectar orden: si el primer bloque tiene 4 digitos, es YYYY-MM-DD.
        a, b, c = partes
        if len(a) == 4:
            anio, mes, dia = int(a), int(b), int(c)
        else:
            dia, mes, anio = int(a), int(b), int(c)
        return _construir(dia, mes, anio)

    # Compacto: solo digitos.
    solo = "".join(c for c in s if c.isdigit())
    if len(solo) == 8:
        dia = int(solo[0:2])
        mes = int(solo[2:4])
        anio = int(solo[4:8])
        return _construir(dia, mes, anio)

    raise ValueError(f"Formato de fecha no reconocido: {valor!r}")
