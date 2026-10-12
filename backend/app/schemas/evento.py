from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.fechas_parse import parse_fecha
from app.db.models.enums import TipoDiaOperativo


def _parse_fecha_obligatoria(v: object) -> object:
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        return parse_fecha(v)
    return v


class TipoEventoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    nombre: str
    afecta_colegio: bool
    afecta_hogar: bool
    genera_extra_100: bool
    color_hex: str
    fuerza_tipo_dia_operativo: Optional[TipoDiaOperativo] = None
    activo: bool


class EventoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo_evento_id: int
    tipo_evento_codigo: str
    tipo_evento_nombre: str
    tipo_evento_color: str
    nombre: str
    desde: date
    hasta: date
    anio: int
    observacion: Optional[str] = None
    fecha_creacion: datetime


class EventoCreate(BaseModel):
    tipo_evento_id: int
    nombre: str = Field(min_length=1, max_length=150)
    desde: date
    hasta: date
    observacion: Optional[str] = Field(default=None, max_length=500)

    @field_validator("desde", "hasta", mode="before")
    @classmethod
    def _v_fecha(cls, v: object) -> object:
        return _parse_fecha_obligatoria(v)

    @field_validator("nombre", mode="before")
    @classmethod
    def _v_nombre(cls, v: object) -> object:
        if isinstance(v, str):
            return " ".join(v.split())
        return v

    @field_validator("observacion", mode="before")
    @classmethod
    def _v_obs(cls, v: object) -> object:
        if isinstance(v, str):
            s = " ".join(v.split())
            return s or None
        return v


class EventoUpdate(BaseModel):
    tipo_evento_id: Optional[int] = None
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=150)
    desde: Optional[date] = None
    hasta: Optional[date] = None
    observacion: Optional[str] = Field(default=None, max_length=500)

    @field_validator("desde", "hasta", mode="before")
    @classmethod
    def _v_fecha(cls, v: object) -> object:
        if v is None or v == "":
            return None
        return _parse_fecha_obligatoria(v)

    @field_validator("nombre", mode="before")
    @classmethod
    def _v_nombre(cls, v: object) -> object:
        if isinstance(v, str):
            return " ".join(v.split())
        return v

    @field_validator("observacion", mode="before")
    @classmethod
    def _v_obs(cls, v: object) -> object:
        if isinstance(v, str):
            s = " ".join(v.split())
            return s or None
        return v
