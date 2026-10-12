"""Gestion de publicacion mensual de la grilla.

- BORRADOR: editable por editores.
- PUBLICADO: cerrado; se puede reabrir con confirmacion.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models.enums import EstadoPeriodoGrilla
from app.db.models.personas import Usuario
from app.db.models.publicacion import PeriodoGrilla
from app.schemas.publicacion import PeriodoGrillaOut


def get_periodo(
    db: Session, anio: int, mes: int
) -> PeriodoGrilla | None:
    return (
        db.query(PeriodoGrilla)
        .filter(PeriodoGrilla.anio == anio)
        .filter(PeriodoGrilla.mes == mes)
        .one_or_none()
    )


def to_out(
    db: Session, periodo: PeriodoGrilla | None, anio: int, mes: int
) -> PeriodoGrillaOut:
    if periodo is None:
        return PeriodoGrillaOut(
            anio=anio,
            mes=mes,
            estado=EstadoPeriodoGrilla.BORRADOR,
            fecha_publicacion=None,
            publicado_por_username=None,
        )

    username = None
    if periodo.publicado_por:
        u = db.get(Usuario, periodo.publicado_por)
        if u is not None:
            username = u.username

    return PeriodoGrillaOut(
        anio=periodo.anio,
        mes=periodo.mes,
        estado=periodo.estado,
        fecha_publicacion=periodo.fecha_publicacion,
        publicado_por_username=username,
    )


def publicar(
    db: Session, anio: int, mes: int, usuario_id: int
) -> PeriodoGrilla:
    periodo = get_periodo(db, anio, mes)
    if periodo is None:
        periodo = PeriodoGrilla(
            anio=anio,
            mes=mes,
            estado=EstadoPeriodoGrilla.PUBLICADO,
            fecha_publicacion=datetime.now(tz=timezone.utc),
            publicado_por=usuario_id,
        )
        db.add(periodo)
    else:
        if periodo.estado == EstadoPeriodoGrilla.PUBLICADO:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El mes {anio}-{mes:02d} ya esta publicado",
            )
        periodo.estado = EstadoPeriodoGrilla.PUBLICADO
        periodo.fecha_publicacion = datetime.now(tz=timezone.utc)
        periodo.publicado_por = usuario_id
    db.commit()
    db.refresh(periodo)
    return periodo


def reabrir(
    db: Session, anio: int, mes: int, usuario_id: int
) -> PeriodoGrilla:
    periodo = get_periodo(db, anio, mes)
    if periodo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El mes {anio}-{mes:02d} no tiene periodo",
        )
    if periodo.estado == EstadoPeriodoGrilla.BORRADOR:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El mes ya esta en borrador",
        )
    periodo.estado = EstadoPeriodoGrilla.BORRADOR
    periodo.fecha_publicacion = None
    periodo.publicado_por = None
    db.commit()
    db.refresh(periodo)
    return periodo
