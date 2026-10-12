from __future__ import annotations

from datetime import datetime, time

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from app.api.deps import CurrentUserDep, DbDep
from app.db.models.enums import ContextoFranja
from app.db.models.operativa import Franja

router = APIRouter(prefix="/franjas", tags=["franjas"])


def _duracion_horas(hi: time, hf: time) -> float:
    """Horas entre hi y hf. Asume que no cruza medianoche."""
    hoy = datetime(2000, 1, 1)
    a = datetime.combine(hoy, hi)
    b = datetime.combine(hoy, hf)
    delta = (b - a).total_seconds() / 3600.0
    return round(delta, 2)


class FranjaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    hora_inicio: str
    hora_fin: str
    horas: float
    codigo_corto: str | None
    contexto: ContextoFranja | None
    activa: bool
    orden: int


@router.get("", response_model=list[FranjaOut])
def listar(db: DbDep, _user: CurrentUserDep) -> list[FranjaOut]:
    franjas = (
        db.query(Franja)
        .filter(Franja.activa.is_(True))
        .order_by(Franja.orden)
        .all()
    )
    return [
        FranjaOut(
            id=f.id,
            nombre=f.nombre,
            hora_inicio=f.hora_inicio.strftime("%H:%M"),
            hora_fin=f.hora_fin.strftime("%H:%M"),
            horas=_duracion_horas(f.hora_inicio, f.hora_fin),
            codigo_corto=f.codigo_corto,
            contexto=f.contexto,
            activa=f.activa,
            orden=f.orden,
        )
        for f in franjas
    ]
