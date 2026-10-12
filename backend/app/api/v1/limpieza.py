"""Endpoints de limpieza (carga manual).

- GET    /api/v1/limpieza/tipos
- GET    /api/v1/limpieza/mes?anio&mes
- POST   /api/v1/limpieza/asignaciones
- PATCH  /api/v1/limpieza/asignaciones/{id}
- DELETE /api/v1/limpieza/asignaciones/{id}
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import CurrentUserDep, DbDep, require_role
from app.db.models.enums import Rol
from app.db.models.limpieza import AsignacionLimpieza, TipoTareaLimpieza
from app.db.models.personas import Empleado
from app.schemas.limpieza import (
    AsignacionLimpiezaCreate,
    AsignacionLimpiezaOut,
    AsignacionLimpiezaUpdate,
    MesLimpiezaOut,
    TipoTareaLimpiezaOut,
)
from app.services.fechas import rango_mes

router = APIRouter(prefix="/limpieza", tags=["limpieza"])


def _asig_to_out(a: AsignacionLimpieza) -> AsignacionLimpiezaOut:
    emp = a.empleado
    tt = a.tipo_tarea
    return AsignacionLimpiezaOut(
        id=a.id,
        empleado_id=a.empleado_id,
        empleado_nombre=f"{emp.apellido}, {emp.nombre}" if emp else "?",
        fecha=a.fecha,
        tipo_tarea_id=a.tipo_tarea_id,
        tipo_tarea_codigo=tt.codigo if tt else "?",
        tipo_tarea_nombre=tt.nombre if tt else "?",
        tipo_tarea_color=tt.color_hex if tt else "#94a3b8",
        observacion=a.observacion,
    )


@router.get(
    "/tipos",
    response_model=list[TipoTareaLimpiezaOut],
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def listar_tipos(
    db: DbDep, _user: CurrentUserDep
) -> list[TipoTareaLimpieza]:
    return (
        db.query(TipoTareaLimpieza)
        .filter(TipoTareaLimpieza.activo.is_(True))
        .order_by(TipoTareaLimpieza.id)
        .all()
    )


@router.get(
    "/asignaciones-por-fecha",
    response_model=list[AsignacionLimpiezaOut],
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def listar_por_fecha(
    db: DbDep,
    _user: CurrentUserDep,
    fecha: str = Query(...),
) -> list[AsignacionLimpiezaOut]:
    from app.core.fechas_parse import parse_fecha

    f = parse_fecha(fecha)
    asignaciones = (
        db.query(AsignacionLimpieza)
        .options(
            joinedload(AsignacionLimpieza.empleado),
            joinedload(AsignacionLimpieza.tipo_tarea),
        )
        .filter(AsignacionLimpieza.fecha == f)
        .order_by(AsignacionLimpieza.tipo_tarea_id)
        .all()
    )
    return [_asig_to_out(a) for a in asignaciones]


@router.get(
    "/mes",
    response_model=MesLimpiezaOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def listar_mes(
    db: DbDep,
    _user: CurrentUserDep,
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
) -> MesLimpiezaOut:
    primero, ultimo = rango_mes(anio, mes)

    tipos = (
        db.query(TipoTareaLimpieza)
        .filter(TipoTareaLimpieza.activo.is_(True))
        .order_by(TipoTareaLimpieza.id)
        .all()
    )

    asignaciones = (
        db.query(AsignacionLimpieza)
        .options(
            joinedload(AsignacionLimpieza.empleado),
            joinedload(AsignacionLimpieza.tipo_tarea),
        )
        .filter(AsignacionLimpieza.fecha >= primero)
        .filter(AsignacionLimpieza.fecha <= ultimo)
        .order_by(AsignacionLimpieza.fecha, AsignacionLimpieza.tipo_tarea_id)
        .all()
    )

    return MesLimpiezaOut(
        anio=anio,
        mes=mes,
        tipos=[TipoTareaLimpiezaOut.model_validate(t) for t in tipos],
        asignaciones=[_asig_to_out(a) for a in asignaciones],
    )


@router.post(
    "/asignaciones",
    response_model=AsignacionLimpiezaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def crear_asignacion(
    db: DbDep, user: CurrentUserDep, payload: AsignacionLimpiezaCreate
) -> AsignacionLimpiezaOut:
    # Validar empleado y tipo
    if db.get(Empleado, payload.empleado_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Empleado {payload.empleado_id} no existe",
        )
    if db.get(TipoTareaLimpieza, payload.tipo_tarea_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tipo de tarea {payload.tipo_tarea_id} no existe",
        )

    # Verificar que no haya otra asignacion del mismo empleado ese dia.
    emp_ocupado = (
        db.query(AsignacionLimpieza)
        .filter(AsignacionLimpieza.empleado_id == payload.empleado_id)
        .filter(AsignacionLimpieza.fecha == payload.fecha)
        .one_or_none()
    )
    if emp_ocupado is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El empleado ya tiene una tarea de limpieza ese dia",
        )

    # Verificar que la tarea no este ya asignada ese dia.
    tarea_ocupada = (
        db.query(AsignacionLimpieza)
        .filter(AsignacionLimpieza.tipo_tarea_id == payload.tipo_tarea_id)
        .filter(AsignacionLimpieza.fecha == payload.fecha)
        .one_or_none()
    )
    if tarea_ocupada is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta tarea ya esta asignada ese dia",
        )

    a = AsignacionLimpieza(
        empleado_id=payload.empleado_id,
        fecha=payload.fecha,
        tipo_tarea_id=payload.tipo_tarea_id,
        origen="MANUAL",
        observacion=payload.observacion,
        asignada_por=user.id,
    )
    db.add(a)
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
    return _asig_to_out(a)


@router.patch(
    "/asignaciones/{asignacion_id}",
    response_model=AsignacionLimpiezaOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def actualizar_asignacion(
    db: DbDep,
    asignacion_id: int,
    payload: AsignacionLimpiezaUpdate,
) -> AsignacionLimpiezaOut:
    a = db.get(AsignacionLimpieza, asignacion_id)
    if a is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asignacion {asignacion_id} no existe",
        )
    data = payload.model_dump(exclude_unset=True)

    if "empleado_id" in data and data["empleado_id"] != a.empleado_id:
        # Verificar que el nuevo empleado no tenga tarea ese dia.
        ocupado = (
            db.query(AsignacionLimpieza)
            .filter(AsignacionLimpieza.empleado_id == data["empleado_id"])
            .filter(AsignacionLimpieza.fecha == a.fecha)
            .one_or_none()
        )
        if ocupado is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El nuevo empleado ya tiene una tarea de limpieza ese dia",
            )
        a.empleado_id = data["empleado_id"]

    if "observacion" in data:
        a.observacion = data["observacion"]

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
    return _asig_to_out(a)


@router.delete(
    "/asignaciones/{asignacion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def eliminar_asignacion(db: DbDep, asignacion_id: int) -> Response:
    a = db.get(AsignacionLimpieza, asignacion_id)
    if a is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asignacion {asignacion_id} no existe",
        )
    db.delete(a)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
