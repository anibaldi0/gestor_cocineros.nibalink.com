from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.deps import CurrentUserDep, DbDep, require_role
from app.db.models.enums import EstadoTurno, Rol
from app.db.models.jornada import Turno
from app.db.models.operativa import Franja
from app.db.models.personas import Empleado
from app.schemas.grilla import GrillaMesOut, RellenoHuecosOut
from app.services.calendario import eventos_activos_en, eventos_del_mes
from app.services.fechas import dias_del_mes, rango_mes
from app.services.grilla import construir_grilla

router = APIRouter(prefix="/grilla", tags=["grilla"])


@router.post(
    "/rellenar-huecos",
    response_model=RellenoHuecosOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def rellenar_huecos(
    db: DbDep,
    user: CurrentUserDep,
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
) -> RellenoHuecosOut:
    """Rellena los dias L-V no feriados con turno M por defecto.

    - Solo para empleados activos.
    - No pisa turnos existentes (de cualquier estado).
    - Usa la franja LU_VIE_MANANA_7_15 con 8 horas.
    """
    franja = (
        db.query(Franja)
        .filter(Franja.nombre == "LU_VIE_MANANA_7_15")
        .filter(Franja.activa.is_(True))
        .one_or_none()
    )
    if franja is None:
        raise HTTPException(
            status_code=500,
            detail="Franja LU_VIE_MANANA_7_15 no encontrada",
        )

    empleados = (
        db.query(Empleado).filter(Empleado.activo.is_(True)).all()
    )
    primero, ultimo = rango_mes(anio, mes)

    # Dias habiles: L-V no feriados.
    eventos = eventos_del_mes(db, anio, mes)
    dias_habiles = []
    for f in dias_del_mes(anio, mes):
        if f.weekday() >= 5:
            continue
        activos = eventos_activos_en(f, eventos)
        if any(e.genera_extra_100 for e in activos):
            continue
        dias_habiles.append(f)

    # Turnos existentes del mes (para no pisar nada).
    existentes = (
        db.query(Turno.empleado_id, Turno.fecha)
        .filter(Turno.fecha >= primero)
        .filter(Turno.fecha <= ultimo)
        .all()
    )
    ya_cargados = {(row.empleado_id, row.fecha) for row in existentes}

    creados = 0
    for emp in empleados:
        for f in dias_habiles:
            if (emp.id, f) in ya_cargados:
                continue
            db.add(
                Turno(
                    empleado_id=emp.id,
                    fecha=f,
                    franja_id=franja.id,
                    estado=EstadoTurno.TRABAJO,
                    horas=8,
                    created_by=user.id,
                )
            )
            creados += 1

    db.commit()

    return RellenoHuecosOut(
        anio=anio,
        mes=mes,
        empleados=len(empleados),
        dias_habiles=len(dias_habiles),
        creados=creados,
    )


@router.get("/mes", response_model=GrillaMesOut)
def grilla_mes(
    db: DbDep,
    _user: CurrentUserDep,
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
) -> GrillaMesOut:
    """Grilla completa del mes: dias + empleados + turnos."""
    return construir_grilla(db, anio, mes)
