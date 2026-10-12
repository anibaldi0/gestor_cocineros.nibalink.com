from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUserDep, DbDep, require_role
from app.core.fechas_parse import parse_fecha
from app.db.models.enums import EstadoTurno, Rol
from app.db.models.jornada import Turno
from app.schemas.turno import TurnoOut, TurnoUpsert

router = APIRouter(prefix="/turnos", tags=["turnos"])


@router.post(
    "",
    response_model=TurnoOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def upsert_turno(db: DbDep, user: CurrentUserDep, payload: TurnoUpsert) -> Turno:
    """Crea o actualiza el turno de un empleado para una fecha.

    Reglas:
    - Si estado = FRANCO y es_franco_protegido=True, la nota es obligatoria.
    - Si el turno deja de ser FRANCO, se limpia el flag CF y la nota.
    - Un solo turno por empleado por dia.
    - horas_extra es libre (0-24) y no depende del estado.
    """
    if payload.estado == EstadoTurno.FRANCO and payload.es_franco_protegido:
        if not payload.nota or not payload.nota.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "codigo": "NOTA_CF_OBLIGATORIA",
                    "mensaje": "El franco protegido (CF) requiere una nota.",
                },
            )

    es_cf = payload.es_franco_protegido and payload.estado == EstadoTurno.FRANCO
    nota = payload.nota if es_cf else None

    if payload.estado == EstadoTurno.TRABAJO and payload.franja_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "codigo": "FRANJA_OBLIGATORIA",
                "mensaje": "Un turno de trabajo requiere franja.",
            },
        )

    existente = (
        db.query(Turno)
        .filter(Turno.empleado_id == payload.empleado_id)
        .filter(Turno.fecha == payload.fecha)
        .one_or_none()
    )

    if existente is None:
        turno = Turno(
            empleado_id=payload.empleado_id,
            fecha=payload.fecha,
            franja_id=payload.franja_id if payload.estado == EstadoTurno.TRABAJO else None,
            estado=payload.estado,
            horas=payload.horas,
            horas_extra=payload.horas_extra,
            es_franco_protegido=es_cf,
            nota=nota,
            created_by=user.id,
        )
        db.add(turno)
    else:
        turno = existente
        turno.franja_id = (
            payload.franja_id if payload.estado == EstadoTurno.TRABAJO else None
        )
        turno.estado = payload.estado
        turno.horas = payload.horas
        turno.horas_extra = payload.horas_extra
        turno.es_franco_protegido = es_cf
        turno.nota = nota
        turno.updated_by = user.id

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflicto al guardar turno: {exc.orig}",
        )

    db.refresh(turno)
    return turno


@router.delete(
    "/{empleado_id}/{fecha}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def borrar_turno(db: DbDep, empleado_id: int, fecha: str) -> Response:
    f = parse_fecha(fecha)
    turno = (
        db.query(Turno)
        .filter(Turno.empleado_id == empleado_id)
        .filter(Turno.fecha == f)
        .one_or_none()
    )
    if turno is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Turno no encontrado",
        )
    db.delete(turno)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
