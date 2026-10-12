from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.fechas_parse import parse_fecha
from app.db.models.enums import EstadoVacacionesAnuales, ModoConteo


def _parse_fecha_opcional(v: object) -> object:
    if v is None or v == "":
        return None
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        return parse_fecha(v)
    return v


# ----------------------------------------------------------------------
# Saldo anual
# ----------------------------------------------------------------------
class VacacionesAnualesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    anio: int
    empleado_id: int
    dias_totales: int
    modo_conteo: ModoConteo
    estado: EstadoVacacionesAnuales
    dias_arrastrados: int
    observacion: Optional[str] = None
    fecha_carga: datetime
    # Calculados, no columnas
    dias_tomados: int = 0
    dias_pendientes: int = 0


class VacacionesAnualesCreate(BaseModel):
    dias_totales: int = Field(ge=0, le=365)
    modo_conteo: ModoConteo
    observacion: Optional[str] = Field(default=None, max_length=500)


class VacacionesAnualesUpdate(BaseModel):
    dias_totales: Optional[int] = Field(default=None, ge=0, le=365)
    modo_conteo: Optional[ModoConteo] = None
    observacion: Optional[str] = Field(default=None, max_length=500)
    dias_arrastrados: Optional[int] = Field(default=None, ge=0, le=365)


# ----------------------------------------------------------------------
# Novedad (periodo)
# ----------------------------------------------------------------------
class NovedadVacacionesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    empleado_id: int
    anio_vacacional: int
    desde: date
    hasta: date
    dias_solicitados: int
    dias_computados: int
    observacion: Optional[str] = None
    estado: str
    fecha_creacion: datetime


class NovedadVacacionesCreate(BaseModel):
    empleado_id: int
    anio_vacacional: int = Field(ge=2000, le=2100)
    desde: date
    dias: int = Field(ge=1, le=365)
    observacion: Optional[str] = Field(default=None, max_length=500)

    @field_validator("desde", mode="before")
    @classmethod
    def _v_desde(cls, v: object) -> object:
        return _parse_fecha_opcional(v)


class NovedadVacacionesUpdate(BaseModel):
    """Editar un periodo. Todos los campos son opcionales."""

    desde: Optional[date] = None
    dias: Optional[int] = Field(default=None, ge=1, le=365)
    observacion: Optional[str] = Field(default=None, max_length=500)

    @field_validator("desde", mode="before")
    @classmethod
    def _v_desde(cls, v: object) -> object:
        return _parse_fecha_opcional(v)


# ----------------------------------------------------------------------
# Listado
# ----------------------------------------------------------------------
class EmpleadoVacacionesOut(BaseModel):
    empleado_id: int
    nombre: str
    apellido: str
    dni: str
    anio: int
    # Si el empleado no tiene saldo cargado ese año, estos van None.
    dias_totales: Optional[int] = None
    modo_conteo: Optional[ModoConteo] = None
    estado: Optional[EstadoVacacionesAnuales] = None
    dias_arrastrados: int = 0
    dias_tomados: int = 0
    dias_pendientes: Optional[int] = None


class ListadoVacacionesOut(BaseModel):
    anio: int
    empleados: list[EmpleadoVacacionesOut]


# ----------------------------------------------------------------------
# Impacto en cobertura
# ----------------------------------------------------------------------
class ImpactoDiaOut(BaseModel):
    fecha: date
    estado: str  # OK | AMARILLO | ROJO
    alertas: int
    mensaje: Optional[str] = None


class ImpactoCoberturaOut(BaseModel):
    desde: date
    hasta: date
    dias: list[ImpactoDiaOut]


# ----------------------------------------------------------------------
# Cierre anual
# ----------------------------------------------------------------------
class CierreAnioItemIn(BaseModel):
    empleado_id: int
    decision: str  # PERDER | ARRASTRAR | COMPENSAR


class CierreAnioIn(BaseModel):
    items: list[CierreAnioItemIn]


class CierreAnioOut(BaseModel):
    anio: int
    procesados: int
    detalle: list[str]
