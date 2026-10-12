from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.db.models.enums import ContextoFranja, TipoConfiguracion, TipoDiaOperativo


# ----------------------------------------------------------------------
# Reglas de cobertura
# ----------------------------------------------------------------------
class ReglaCoberturaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo_dia_operativo: TipoDiaOperativo
    franja_id: int
    franja_nombre: str
    franja_codigo_corto: Optional[str] = None
    franja_contexto: Optional[ContextoFranja] = None
    cantidad_minima: int
    cantidad_ideal: int
    activo: bool


class ReglaCoberturaUpdate(BaseModel):
    cantidad_minima: Optional[int] = Field(default=None, ge=0, le=50)
    cantidad_ideal: Optional[int] = Field(default=None, ge=0, le=50)
    activo: Optional[bool] = None


# ----------------------------------------------------------------------
# Configuracion (umbrales de alertas)
# ----------------------------------------------------------------------
class ConfiguracionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    clave: str
    valor: str
    tipo: TipoConfiguracion
    descripcion: Optional[str] = None
    categoria: Optional[str] = None


class ConfiguracionUpdate(BaseModel):
    valor: str = Field(min_length=1, max_length=200)
