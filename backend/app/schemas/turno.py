from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.fechas_parse import parse_fecha
from app.db.models.enums import EstadoTurno


class TurnoUpsert(BaseModel):
    """Payload para crear o actualizar el turno de un empleado en una fecha.

    Es idempotente: si ya existe un turno (empleado_id, fecha), lo actualiza.
    """

    empleado_id: int
    fecha: date
    estado: EstadoTurno
    franja_id: Optional[int] = None
    horas: float = Field(default=0, ge=0, le=24)
    horas_extra: float = Field(default=0, ge=0, le=24)
    es_franco_protegido: bool = False
    nota: Optional[str] = Field(default=None, max_length=200)

    @field_validator("fecha", mode="before")
    @classmethod
    def _v_fecha(cls, v: object) -> object:
        if isinstance(v, str):
            return parse_fecha(v)
        return v

    @field_validator("nota", mode="before")
    @classmethod
    def _v_nota(cls, v: object) -> object:
        if isinstance(v, str):
            s = " ".join(v.split())
            return s or None
        return v


class TurnoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    empleado_id: int
    fecha: date
    franja_id: Optional[int]
    estado: EstadoTurno
    horas: float
    horas_extra: float
    es_franco_protegido: bool
    nota: Optional[str]
