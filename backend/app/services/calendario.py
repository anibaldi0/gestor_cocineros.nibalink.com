"""Dominio: resolucion de tipo_dia_operativo y eventos activos por dia.

Regla de resolucion (README seccion 6.1 + prioridad de superposicion):

1. Base: sabado/domingo -> FINDE_FERIADO; L-V -> DIA_LABORAL_CON_COLEGIO.
2. Cada evento activo puede forzar un tipo_dia_operativo (fuerza_tipo_dia_operativo).
3. Gana el de mayor prioridad: FINDE_FERIADO > DIA_LABORAL_SIN_COLEGIO > base.

Este modulo es puro en su nucleo (funcion `resolver_tipo_dia_operativo`).
La parte que toca DB esta separada para poder testear sin base.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Sequence

from sqlalchemy.orm import Session

from app.db.models.calendario import EventoCalendario
from app.db.models.enums import TipoDiaOperativo
from app.services.fechas import es_fin_de_semana


# Orden de prioridad: mayor gana.
_PRIORIDAD: dict[TipoDiaOperativo, int] = {
    TipoDiaOperativo.FINDE_FERIADO: 3,
    TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO: 2,
    TipoDiaOperativo.DIA_LABORAL_CON_COLEGIO: 1,
}


@dataclass(frozen=True)
class EventoActivo:
    """Vista minima de un evento para el calculo. Sin acoplamiento a ORM."""

    id: int
    codigo: str
    nombre: str
    color_hex: str
    afecta_colegio: bool
    afecta_hogar: bool
    genera_extra_100: bool
    fuerza_tipo_dia_operativo: TipoDiaOperativo | None


def _base(fecha: date) -> TipoDiaOperativo:
    if es_fin_de_semana(fecha):
        return TipoDiaOperativo.FINDE_FERIADO
    return TipoDiaOperativo.DIA_LABORAL_CON_COLEGIO


def resolver_tipo_dia_operativo(
    fecha: date, eventos: Sequence[EventoActivo]
) -> TipoDiaOperativo:
    """Aplica la regla de prioridad. Funcion pura, testeable sin DB."""
    resultado = _base(fecha)
    for ev in eventos:
        fuerza = ev.fuerza_tipo_dia_operativo
        if fuerza is None:
            continue
        if _PRIORIDAD[fuerza] > _PRIORIDAD[resultado]:
            resultado = fuerza
    return resultado


def _to_activo(ev: EventoCalendario) -> EventoActivo:
    return EventoActivo(
        id=ev.id,
        codigo=ev.tipo_evento.codigo,
        nombre=ev.nombre,
        color_hex=ev.tipo_evento.color_hex,
        afecta_colegio=ev.tipo_evento.afecta_colegio,
        afecta_hogar=ev.tipo_evento.afecta_hogar,
        genera_extra_100=ev.tipo_evento.genera_extra_100,
        fuerza_tipo_dia_operativo=ev.tipo_evento.fuerza_tipo_dia_operativo,
    )


def eventos_del_mes(db: Session, anio: int, mes: int) -> list[EventoCalendario]:
    """Trae todos los eventos que solapan con el mes, con su tipo cargado."""
    from app.services.fechas import rango_mes

    primero, ultimo = rango_mes(anio, mes)
    return (
        db.query(EventoCalendario)
        .filter(EventoCalendario.desde <= ultimo)
        .filter(EventoCalendario.hasta >= primero)
        .all()
    )


def eventos_activos_en(
    fecha: date, eventos: Sequence[EventoCalendario]
) -> list[EventoActivo]:
    """Filtra los eventos que cubren la fecha dada. Devuelve la vista minima."""
    return [_to_activo(ev) for ev in eventos if ev.desde <= fecha <= ev.hasta]
