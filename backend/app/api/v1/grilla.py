from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.deps import CurrentUserDep, DbDep
from app.schemas.grilla import GrillaMesOut
from app.services.grilla import construir_grilla

router = APIRouter(prefix="/grilla", tags=["grilla"])


@router.get("/mes", response_model=GrillaMesOut)
def grilla_mes(
    db: DbDep,
    _user: CurrentUserDep,
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
) -> GrillaMesOut:
    """Grilla completa del mes: dias + empleados + turnos."""
    return construir_grilla(db, anio, mes)
