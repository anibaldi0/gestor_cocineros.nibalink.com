from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import CurrentUserDep, DbDep
from app.schemas.dashboard import DashboardEmpleadoOut
from app.services.dashboard import construir_dashboard

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/dashboard", response_model=DashboardEmpleadoOut)
def dashboard(
    db: DbDep,
    user: CurrentUserDep,
    anio: int = Query(
        default_factory=lambda: date.today().year, ge=2000, le=2100
    ),
    mes: int = Query(
        default_factory=lambda: date.today().month, ge=1, le=12
    ),
) -> DashboardEmpleadoOut:
    """Dashboard personal del empleado logueado."""
    return construir_dashboard(db, user, anio, mes)
