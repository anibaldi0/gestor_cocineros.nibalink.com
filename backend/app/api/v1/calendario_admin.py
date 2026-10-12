"""CRUD de eventos de calendario.

- Listado por anio.
- Listado de tipos (para el dropdown).
- Crear, editar, borrar eventos.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import CurrentUserDep, DbDep, require_role
from app.db.models.calendario import EventoCalendario, TipoEventoCalendario
from app.db.models.enums import Rol
from app.services.evento_impacto import calcular_impacto
from app.schemas.evento import (
    EventoCreate,
    EventoOut,
    EventoUpdate,
    TipoEventoOut,
)

router = APIRouter(prefix="/calendario", tags=["calendario-admin"])


def _to_out(evento: EventoCalendario) -> EventoOut:
    te = evento.tipo_evento
    return EventoOut(
        id=evento.id,
        tipo_evento_id=evento.tipo_evento_id,
        tipo_evento_codigo=te.codigo,
        tipo_evento_nombre=te.nombre,
        tipo_evento_color=te.color_hex,
        nombre=evento.nombre,
        desde=evento.desde,
        hasta=evento.hasta,
        anio=evento.anio,
        observacion=evento.observacion,
        fecha_creacion=evento.fecha_creacion,
    )


@router.get(
    "/tipos",
    response_model=list[TipoEventoOut],
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def listar_tipos(
    db: DbDep, _user: CurrentUserDep
) -> list[TipoEventoCalendario]:
    """Listado de tipos de evento activos, para el dropdown."""
    return (
        db.query(TipoEventoCalendario)
        .filter(TipoEventoCalendario.activo.is_(True))
        .order_by(TipoEventoCalendario.id)
        .all()
    )


@router.get(
    "/eventos",
    response_model=list[EventoOut],
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def listar_eventos(
    db: DbDep,
    _user: CurrentUserDep,
    anio: int = Query(..., ge=2000, le=2100),
) -> list[EventoOut]:
    """Eventos del anio indicado."""
    eventos = (
        db.query(EventoCalendario)
        .options(joinedload(EventoCalendario.tipo_evento))
        .filter(EventoCalendario.anio == anio)
        .order_by(EventoCalendario.desde, EventoCalendario.id)
        .all()
    )
    return [_to_out(e) for e in eventos]


@router.post(
    "/eventos",
    response_model=EventoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def crear_evento(
    db: DbDep,
    user: CurrentUserDep,
    payload: EventoCreate,
    confirmar_impacto: bool = Query(default=False),
) -> EventoOut:
    if payload.hasta < payload.desde:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de fin no puede ser anterior al inicio",
        )
    tipo = db.get(TipoEventoCalendario, payload.tipo_evento_id)
    if tipo is None or not tipo.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tipo de evento {payload.tipo_evento_id} no existe",
        )

    # Impacto: si el tipo genera HE al 100%, ver si afecta turnos cargados.
    if tipo.genera_extra_100 and not confirmar_impacto:
        impacto = calcular_impacto(db, payload.desde, payload.hasta)
        if impacto.dias:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "codigo": "EVENTO_AFECTA_GRILLA",
                    "mensaje": (
                        f"El evento afecta {len(impacto.dias)} dia(s) con "
                        f"personal ya cargado."
                    ),
                    "impacto": {
                        "dias": [
                            {
                                "fecha": d.fecha.isoformat(),
                                "turnos_cargados": d.turnos_cargados,
                                "horas_totales": d.horas_totales,
                                "horas_extra_estimadas": d.horas_extra_estimadas,
                                "cobertura_minima": d.cobertura_minima,
                                "exceso_personal": d.exceso_personal,
                                "mensaje": d.mensaje,
                            }
                            for d in impacto.dias
                        ],
                        "total_horas_extra_estimadas": impacto.total_horas_extra_estimadas,
                        "total_exceso_personal": impacto.total_exceso_personal,
                    },
                },
            )

    evento = EventoCalendario(
        tipo_evento_id=payload.tipo_evento_id,
        nombre=payload.nombre,
        desde=payload.desde,
        hasta=payload.hasta,
        anio=payload.desde.year,
        observacion=payload.observacion,
        creado_por=user.id,
    )
    db.add(evento)
    db.commit()
    db.refresh(evento)

    evento = (
        db.query(EventoCalendario)
        .options(joinedload(EventoCalendario.tipo_evento))
        .filter(EventoCalendario.id == evento.id)
        .one()
    )
    return _to_out(evento)


@router.patch(
    "/eventos/{evento_id}",
    response_model=EventoOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def actualizar_evento(
    db: DbDep,
    user: CurrentUserDep,
    evento_id: int,
    payload: EventoUpdate,
) -> EventoOut:
    evento = (
        db.query(EventoCalendario)
        .options(joinedload(EventoCalendario.tipo_evento))
        .filter(EventoCalendario.id == evento_id)
        .one_or_none()
    )
    if evento is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evento {evento_id} no existe",
        )

    data = payload.model_dump(exclude_unset=True)

    nuevo_desde = data.get("desde", evento.desde)
    nuevo_hasta = data.get("hasta", evento.hasta)
    if nuevo_hasta < nuevo_desde:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de fin no puede ser anterior al inicio",
        )

    if "tipo_evento_id" in data:
        tipo = db.get(TipoEventoCalendario, data["tipo_evento_id"])
        if tipo is None or not tipo.activo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tipo de evento {data['tipo_evento_id']} no existe",
            )

    for k, v in data.items():
        setattr(evento, k, v)
    evento.anio = evento.desde.year
    evento.actualizado_por = user.id

    db.commit()
    db.refresh(evento)

    evento = (
        db.query(EventoCalendario)
        .options(joinedload(EventoCalendario.tipo_evento))
        .filter(EventoCalendario.id == evento_id)
        .one()
    )
    return _to_out(evento)


@router.delete(
    "/eventos/{evento_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def eliminar_evento(db: DbDep, evento_id: int) -> Response:
    evento = db.get(EventoCalendario, evento_id)
    if evento is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evento {evento_id} no existe",
        )
    db.delete(evento)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
