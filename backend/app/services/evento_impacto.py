"""Calculo del impacto de crear un evento que afecta dias con turnos.

Se usa al crear/editar un evento cuyo tipo tiene `genera_extra_100 = true`
(feriado, carnaval, etc.). Si el rango del evento toca dias con turnos
TRABAJO, se calcula:

- Cuantos turnos TRABAJO hay.
- Cuantas horas totales suman.
- Cual seria la cobertura minima en contexto feriado.
- Exceso de personal.
- HE estimadas (todas al 100%).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.db.models.enums import EstadoTurno
from app.db.models.jornada import Turno
from app.services.cobertura import cargar_franjas_por_contexto
from app.db.models.enums import ContextoFranja


@dataclass(frozen=True)
class ImpactoDia:
    fecha: date
    turnos_cargados: int
    horas_totales: float
    horas_extra_estimadas: float
    cobertura_minima: int
    exceso_personal: int
    mensaje: str


@dataclass(frozen=True)
class ImpactoEvento:
    dias: list[ImpactoDia]
    total_horas_extra_estimadas: float
    total_exceso_personal: int


def calcular_impacto(
    db: Session, desde: date, hasta: date
) -> ImpactoEvento:
    """Devuelve el impacto de convertir el rango en feriado."""

    # Cobertura minima en contexto FERIADO (que es el que aplica para
    # cualquier feriado, sea L-V o finde).
    franjas_por_contexto = cargar_franjas_por_contexto(db)
    franjas_feriado = franjas_por_contexto.get(ContextoFranja.FERIADO, [])
    minima_total = sum(f.cantidad_minima for f in franjas_feriado)
    if minima_total == 0:
        # Fallback si no hay franjas FERIADO configuradas:
        # usar FINDE.
        franjas_finde = franjas_por_contexto.get(ContextoFranja.FINDE, [])
        minima_total = sum(f.cantidad_minima for f in franjas_finde)

    # Turnos TRABAJO en el rango
    turnos = (
        db.query(Turno)
        .filter(Turno.fecha >= desde)
        .filter(Turno.fecha <= hasta)
        .filter(Turno.estado == EstadoTurno.TRABAJO)
        .all()
    )

    por_fecha: dict[date, list[Turno]] = {}
    for t in turnos:
        por_fecha.setdefault(t.fecha, []).append(t)

    dias: list[ImpactoDia] = []
    total_he = 0.0
    total_exceso = 0

    actual = desde
    while actual <= hasta:
        ts = por_fecha.get(actual, [])
        if not ts:
            actual = actual + timedelta(days=1)
            continue

        cantidad = len(ts)
        horas = sum(float(t.horas) for t in ts)
        he_estimadas = round(horas, 2)  # todas al 100%
        exceso = max(0, cantidad - minima_total)

        partes = [f"{cantidad} turno(s) cargado(s)"]
        if exceso > 0:
            partes.append(f"exceso de {exceso} persona(s)")
        partes.append(f"{he_estimadas}h extra estimadas al 100%")

        mensaje = (
            f"{actual.isoformat()}: "
            + ", ".join(partes)
            + f". Guardia minima: {minima_total}."
        )

        dias.append(
            ImpactoDia(
                fecha=actual,
                turnos_cargados=cantidad,
                horas_totales=round(horas, 2),
                horas_extra_estimadas=he_estimadas,
                cobertura_minima=minima_total,
                exceso_personal=exceso,
                mensaje=mensaje,
            )
        )
        total_he += he_estimadas
        total_exceso += exceso
        actual = actual + timedelta(days=1)

    return ImpactoEvento(
        dias=dias,
        total_horas_extra_estimadas=round(total_he, 2),
        total_exceso_personal=total_exceso,
    )
