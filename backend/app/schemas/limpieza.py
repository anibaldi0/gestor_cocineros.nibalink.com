from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.fechas_parse import parse_fecha


def _parse_fecha_obligatoria(v: object) -> object:
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        return parse_fecha(v)
    return v


class TipoTareaLimpiezaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    nombre: str
    abreviatura: str
    color_hex: str
    activo: bool


class AsignacionLimpiezaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    empleado_id: int
    empleado_nombre: str
    fecha: date
    tipo_tarea_id: int
    tipo_tarea_codigo: str
    tipo_tarea_nombre: str
    tipo_tarea_abreviatura: str
    tipo_tarea_color: str
    observacion: Optional[str] = None
    firmada_at: Optional[datetime] = None


class AsignacionLimpiezaCreate(BaseModel):
    empleado_id: int
    fecha: date
    tipo_tarea_id: int
    observacion: Optional[str] = Field(default=None, max_length=300)

    @field_validator("fecha", mode="before")
    @classmethod
    def _v_fecha(cls, v: object) -> object:
        return _parse_fecha_obligatoria(v)


class AsignacionLimpiezaUpdate(BaseModel):
    empleado_id: Optional[int] = None
    observacion: Optional[str] = Field(default=None, max_length=300)


class MesLimpiezaOut(BaseModel):
    anio: int
    mes: int
    tipos: list[TipoTareaLimpiezaOut]
    asignaciones: list[AsignacionLimpiezaOut]


# ---- Estructura para el dashboard del empleado ----
class LimpiezaEmpleadoOut(BaseModel):
    fecha: date
    tipo_tarea_id: int
    tipo_tarea_codigo: str
    tipo_tarea_nombre: str
    tipo_tarea_abreviatura: str
    tipo_tarea_color: str
    observacion: Optional[str] = None
    firmada_at: Optional[datetime] = None
