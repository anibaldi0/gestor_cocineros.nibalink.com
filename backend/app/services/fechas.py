"""Utilidades de fecha. Sin dependencias de DB. ASCII puro.

Regla de proyecto: los nombres de dias van SIN tildes para mantener
el codigo en ASCII puro. La UI los muestra tal cual.
"""

from __future__ import annotations

import calendar
from datetime import date


DIAS_SEMANA_ES: tuple[str, ...] = (
    "Lunes",
    "Martes",
    "Miercoles",
    "Jueves",
    "Viernes",
    "Sabado",
    "Domingo",
)


def es_fin_de_semana(fecha: date) -> bool:
    """Lunes=0, Domingo=6. Sabado (5) y Domingo (6) son fin de semana."""
    return fecha.weekday() >= 5


def nombre_dia(fecha: date) -> str:
    return DIAS_SEMANA_ES[fecha.weekday()]


def rango_mes(anio: int, mes: int) -> tuple[date, date]:
    """Primer y ultimo dia del mes (inclusive)."""
    if not 1 <= mes <= 12:
        raise ValueError(f"Mes invalido: {mes}")
    ultimo = calendar.monthrange(anio, mes)[1]
    return date(anio, mes, 1), date(anio, mes, ultimo)


def dias_del_mes(anio: int, mes: int) -> list[date]:
    primero, ultimo = rango_mes(anio, mes)
    delta = (ultimo - primero).days
    return [primero.fromordinal(primero.toordinal() + i) for i in range(delta + 1)]
