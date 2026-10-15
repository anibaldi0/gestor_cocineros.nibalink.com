"""Endpoints de firma de tareas de limpieza.

- POST /api/v1/me/firmar-limpieza/{asignacion_id}   -> el empleado firma.
- DELETE /api/v1/me/firmar-limpieza/{asignacion_id} -> desfirmar (mismo dia).
"""

from __future__ import annotations

from datetime import date as date_type
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import joinedload

from app.api.deps import CurrentUserDep, DbDep
from app.db.models.limpieza import AsignacionLimpieza
from app.schemas.limpieza import AsignacionLimpiezaOut

router = APIRouter(prefix="/me", tags=["firma-limpieza"])


def _hoy_utc() -> date_type:
    return datetime.now(tz=timezone.utc).date()


def _dentro_de_ventana(fecha: date_type) -> bool:
    """La tarea se puede firmar/desfirmar hasta 7 dias despues de su fecha."""
    hoy = _hoy_utc()
    delta = (hoy - fecha).days
    return 0 <= delta <= 7


def _to_out(a: AsignacionLimpieza) -> AsignacionLimpiezaOut:
    return AsignacionLimpiezaOut(
        id=a.id,
        empleado_id=a.empleado_id,
        empleado_nombre=(
            f"{a.empleado.apellido}, {a.empleado.nombre}"
            if a.empleado
            else "?"
        ),
        fecha=a.fecha,
        tipo_tarea_id=a.tipo_tarea_id,
        tipo_tarea_codigo=a.tipo_tarea.codigo if a.tipo_tarea else "?",
        tipo_tarea_nombre=a.tipo_tarea.nombre if a.tipo_tarea else "?",
        tipo_tarea_abreviatura=a.tipo_tarea.abreviatura if a.tipo_tarea else "?",
        tipo_tarea_color=a.tipo_tarea.color_hex if a.tipo_tarea else "#94a3b8",
        observacion=a.observacion,
        firmada_at=a.firmada_at,
    )


@router.post(
    "/firmar-limpieza/{asignacion_id}",
    response_model=AsignacionLimpiezaOut,
)
def firmar(
    db: DbDep, user: CurrentUserDep, asignacion_id: int
) -> AsignacionLimpiezaOut:
    """El empleado firma su propia tarea de limpieza."""
    a = (
        db.query(AsignacionLimpieza)
        .options(
            joinedload(AsignacionLimpieza.empleado),
            joinedload(AsignacionLimpieza.tipo_tarea),
        )
        .filter(AsignacionLimpieza.id == asignacion_id)
        .one_or_none()
    )
    if a is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asignacion {asignacion_id} no existe",
        )
    if user.empleado_id is None or a.empleado_id != user.empleado_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No podes firmar una tarea que no es tuya",
        )
    if a.firmada_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta tarea ya fue firmada",
        )
    if not _dentro_de_ventana(a.fecha):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo podes firmar tareas de los ultimos 7 dias",
        )

    a.firmada_at = datetime.now(tz=timezone.utc)
    a.firmada_por_usuario_id = user.id
    db.commit()
    db.refresh(a)
    a = (
        db.query(AsignacionLimpieza)
        .options(
            joinedload(AsignacionLimpieza.empleado),
            joinedload(AsignacionLimpieza.tipo_tarea),
        )
        .filter(AsignacionLimpieza.id == a.id)
        .one()
    )
    return _to_out(a)


@router.delete(
    "/firmar-limpieza/{asignacion_id}",
    response_model=AsignacionLimpiezaOut,
)
def desfirmar(
    db: DbDep, user: CurrentUserDep, asignacion_id: int
) -> AsignacionLimpiezaOut:
    """El empleado desfirma su propia tarea. Solo el mismo dia."""
    a = (
        db.query(AsignacionLimpieza)
        .options(
            joinedload(AsignacionLimpieza.empleado),
            joinedload(AsignacionLimpieza.tipo_tarea),
        )
        .filter(AsignacionLimpieza.id == asignacion_id)
        .one_or_none()
    )
    if a is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asignacion {asignacion_id} no existe",
        )
    if user.empleado_id is None or a.empleado_id != user.empleado_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No podes desfirmar una tarea que no es tuya",
        )
    if a.firmada_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta tarea no esta firmada",
        )
    if a.fecha != _hoy_utc():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo podes desfirmar tareas del dia de hoy",
        )

    a.firmada_at = None
    a.firmada_por_usuario_id = None
    db.commit()
    db.refresh(a)
    a = (
        db.query(AsignacionLimpieza)
        .options(
            joinedload(AsignacionLimpieza.empleado),
            joinedload(AsignacionLimpieza.tipo_tarea),
        )
        .filter(AsignacionLimpieza.id == a.id)
        .one()
    )
    return _to_out(a)
