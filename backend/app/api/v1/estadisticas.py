"""Endpoints de estadisticas."""

from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUserDep, DbDep, require_role
from app.db.models.enums import Rol
from app.schemas.estadisticas import (
    StatsAnioOut,
    StatsHistoricoOut,
    StatsMesOut,
)
from app.services.estadisticas import (
    construir_estadisticas_anio,
    construir_estadisticas_historico,
    construir_estadisticas_mes,
)

router = APIRouter(prefix="/estadisticas", tags=["estadisticas"])


@router.get(
    "/mes",
    response_model=StatsMesOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def stats_mes(
    db: DbDep,
    _user: CurrentUserDep,
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
) -> StatsMesOut:
    return construir_estadisticas_mes(db, anio, mes)


@router.get(
    "/mes.csv",
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def stats_mes_csv(
    db: DbDep,
    _user: CurrentUserDep,
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
) -> StreamingResponse:
    datos = construir_estadisticas_mes(db, anio, mes)

    buf = io.StringIO()
    # BOM UTF-8 para que Excel lo abra bien.
    buf.write("\ufeff")
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")

    writer.writerow(
        [
            "empleado_id",
            "apellido",
            "nombre",
            "dni",
            "horas_semana_max",
            "dias_trabajados",
            "dias_franco",
            "dias_vacaciones",
            "dias_licencia",
            "dias_ausencia",
            "horas_trabajadas",
            "horas_extra",
            "horas_totales",
            "dias_con_he",
        ]
    )
    for e in datos.empleados:
        writer.writerow(
            [
                e.empleado_id,
                e.apellido,
                e.nombre,
                e.dni,
                e.horas_semana_max,
                e.dias_trabajados,
                e.dias_franco,
                e.dias_vacaciones,
                e.dias_licencia,
                e.dias_ausencia,
                e.horas_trabajadas,
                e.horas_extra,
                e.horas_totales,
                e.dias_con_he,
            ]
        )

    buf.seek(0)
    filename = f"estadisticas_{anio}_{mes:02d}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.get(
    "/anio",
    response_model=StatsAnioOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def stats_anio(
    db: DbDep,
    _user: CurrentUserDep,
    anio: int = Query(..., ge=2000, le=2100),
) -> StatsAnioOut:
    """Acumulado anual: suma de los 12 meses."""
    return construir_estadisticas_anio(db, anio)


@router.get(
    "/anio.csv",
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def stats_anio_csv(
    db: DbDep,
    _user: CurrentUserDep,
    anio: int = Query(..., ge=2000, le=2100),
) -> StreamingResponse:
    datos = construir_estadisticas_anio(db, anio)

    buf = io.StringIO()
    buf.write("\ufeff")
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")

    writer.writerow(
        [
            "empleado_id",
            "apellido",
            "nombre",
            "dni",
            "horas_semana_max",
            "dias_trabajados",
            "dias_franco",
            "dias_vacaciones",
            "dias_licencia",
            "dias_ausencia",
            "horas_trabajadas",
            "horas_extra",
            "horas_totales",
            "dias_con_he",
        ]
    )
    for e in datos.empleados:
        writer.writerow(
            [
                e.empleado_id,
                e.apellido,
                e.nombre,
                e.dni,
                e.horas_semana_max,
                e.dias_trabajados,
                e.dias_franco,
                e.dias_vacaciones,
                e.dias_licencia,
                e.dias_ausencia,
                e.horas_trabajadas,
                e.horas_extra,
                e.horas_totales,
                e.dias_con_he,
            ]
        )

    buf.seek(0)
    filename = f"estadisticas_{anio}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.get(
    "/historico",
    response_model=StatsHistoricoOut,
    dependencies=[require_role(Rol.SUPERADMIN)],
)
def stats_historico(
    db: DbDep, _user: CurrentUserDep
) -> StatsHistoricoOut:
    """Historico completo. Solo superadmin."""
    return construir_estadisticas_historico(db)
