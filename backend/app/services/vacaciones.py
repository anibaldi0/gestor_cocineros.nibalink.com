"""Calculo de dias de vacaciones.

Modos:
- CORRIDOS: cuenta todos los dias (incluye findes y feriados).
- HABILES: cuenta solo L-V que no sean feriados.

El modo es fijo por anio vacacional (campo vacaciones_anuales.modo_conteo).
No se mezcla por periodo.

Este modulo tiene un nucleo puro (contar_*_desde) testeable sin DB y un
wrapper que carga los feriados del rango.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.db.models.calendario import EventoCalendario
from app.db.models.enums import ModoConteo
from app.services.fechas import es_fin_de_semana


@dataclass(frozen=True)
class RangoVacaciones:
    """Resultado del calculo: desde, hasta y dias efectivamente computados."""

    desde: date
    hasta: date
    dias_computados: int


def contar_dias_corridos(
    desde: date, dias: int
) -> RangoVacaciones:
    """Cuenta dias corridos. El ultimo dia es desde + (dias - 1)."""
    if dias < 1:
        raise ValueError("dias debe ser >= 1")
    hasta = desde + timedelta(days=dias - 1)
    return RangoVacaciones(desde=desde, hasta=hasta, dias_computados=dias)


def contar_dias_habiles(
    desde: date, dias: int, feriados: set[date]
) -> RangoVacaciones:
    """Cuenta dias habiles (L-V no feriados) empezando desde `desde`.

    Si `desde` no es habil, avanza al siguiente habil. Cuenta hasta
    juntar `dias` habiles.
    """
    if dias < 1:
        raise ValueError("dias debe ser >= 1")

    actual = desde
    contados = 0
    # Guarda para no loopear infinito si pasa algo raro.
    limite = desde + timedelta(days=dias * 4 + 60)

    while contados < dias:
        if actual > limite:
            raise ValueError("No se pudieron contar los dias habiles")
        if not es_fin_de_semana(actual) and actual not in feriados:
            contados += 1
            if contados == dias:
                return RangoVacaciones(
                    desde=desde, hasta=actual, dias_computados=dias
                )
        actual = actual + timedelta(days=1)

    # Inalcanzable, pero por las dudas:
    return RangoVacaciones(desde=desde, hasta=actual, dias_computados=dias)


def cargar_feriados(db: Session, desde: date, hasta: date) -> set[date]:
    """Devuelve el conjunto de fechas feriadas (genera_extra_100) entre
    desde y hasta (inclusive), expandiendo los eventos de calendario.
    """
    eventos = (
        db.query(EventoCalendario)
        .filter(EventoCalendario.desde <= hasta)
        .filter(EventoCalendario.hasta >= desde)
        .all()
    )
    feriados: set[date] = set()
    for ev in eventos:
        if not ev.tipo_evento.genera_extra_100:
            continue
        actual = max(ev.desde, desde)
        tope = min(ev.hasta, hasta)
        while actual <= tope:
            feriados.add(actual)
            actual = actual + timedelta(days=1)
    return feriados


def calcular_periodo(
    db: Session,
    desde: date,
    dias: int,
    modo: ModoConteo,
) -> RangoVacaciones:
    """Calcula el rango completo segun el modo del empleado."""
    if modo == ModoConteo.CORRIDOS:
        return contar_dias_corridos(desde, dias)

    # HABILES: necesitamos feriados. Estimamos el rango maximo para
    # traer los feriados relevantes y después calculamos.
    tope_estimado = desde + timedelta(days=dias * 4 + 60)
    feriados = cargar_feriados(db, desde, tope_estimado)
    return contar_dias_habiles(desde, dias, feriados)
