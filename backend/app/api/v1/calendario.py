from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.deps import CurrentUserDep, DbDep
from app.db.models.enums import TipoDiaOperativo
from app.schemas.calendario import (
    DiaCalendarioOut,
    EventoDiaOut,
    MesCalendarioOut,
)
from app.services.calendario import (
    EventoActivo,
    eventos_activos_en,
    eventos_del_mes,
    resolver_tipo_dia_operativo,
)
from app.services.fechas import dias_del_mes, nombre_dia

router = APIRouter(prefix="/calendario", tags=["calendario"])


def _color_por_prioridad(
    tipo_dia: TipoDiaOperativo, eventos: list[EventoActivo]
) -> str | None:
    """Color del evento de mayor prioridad, o None si no hay eventos que pinten."""
    if not eventos:
        return None
    orden = sorted(
        eventos,
        key=lambda e: (
            0 if e.genera_extra_100 else 1,
            0 if e.afecta_colegio else 1,
        ),
    )
    return orden[0].color_hex


@router.get("/mes", response_model=MesCalendarioOut)
def mes(
    db: DbDep,
    _user: CurrentUserDep,
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
) -> MesCalendarioOut:
    """Calendario operativo del mes: un registro por dia con su tipo y eventos."""
    eventos = eventos_del_mes(db, anio, mes)

    dias: list[DiaCalendarioOut] = []
    for f in dias_del_mes(anio, mes):
        activos = eventos_activos_en(f, eventos)
        tipo = resolver_tipo_dia_operativo(f, activos)

        dias.append(
            DiaCalendarioOut(
                fecha=f,
                dia_semana=f.weekday(),
                nombre_dia=nombre_dia(f),
                tipo_dia_operativo=tipo,
                es_fin_de_semana=f.weekday() >= 5,
                es_feriado=any(e.genera_extra_100 for e in activos),
                cierra_colegio=any(e.afecta_colegio for e in activos),
                color_hex=_color_por_prioridad(tipo, activos),
                eventos=[
                    EventoDiaOut(
                        id=e.id,
                        codigo=e.codigo,
                        nombre=e.nombre,
                        color_hex=e.color_hex,
                        genera_extra_100=e.genera_extra_100,
                    )
                    for e in activos
                ],
            )
        )

    return MesCalendarioOut(anio=anio, mes=mes, dias=dias)
