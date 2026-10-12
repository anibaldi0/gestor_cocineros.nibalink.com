"""Endpoints de publicacion mensual."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.deps import CurrentUserDep, DbDep, require_role
from app.db.models.enums import Rol
from app.schemas.publicacion import PeriodoGrillaOut
from app.services.publicacion import (
    get_periodo,
    publicar as svc_publicar,
    reabrir as svc_reabrir,
    to_out,
)

router = APIRouter(prefix="/grilla/publicacion", tags=["publicacion"])


@router.get(
    "",
    response_model=PeriodoGrillaOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN, Rol.EMPLEADO)],
)
def estado(
    db: DbDep,
    _user: CurrentUserDep,
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
) -> PeriodoGrillaOut:
    """Devuelve el estado del periodo (BORRADOR o PUBLICADO)."""
    periodo = get_periodo(db, anio, mes)
    return to_out(db, periodo, anio, mes)


@router.post(
    "/publicar",
    response_model=PeriodoGrillaOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def publicar(
    db: DbDep,
    user: CurrentUserDep,
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
) -> PeriodoGrillaOut:
    periodo = svc_publicar(db, anio, mes, user.id)
    return to_out(db, periodo, anio, mes)


@router.post(
    "/reabrir",
    response_model=PeriodoGrillaOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def reabrir(
    db: DbDep,
    user: CurrentUserDep,
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
) -> PeriodoGrillaOut:
    periodo = svc_reabrir(db, anio, mes, user.id)
    return to_out(db, periodo, anio, mes)
