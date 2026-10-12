from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.db.models.enums import EstadoPeriodoGrilla


class PeriodoGrillaOut(BaseModel):
    anio: int
    mes: int
    estado: EstadoPeriodoGrilla
    fecha_publicacion: Optional[datetime] = None
    publicado_por_username: Optional[str] = None
