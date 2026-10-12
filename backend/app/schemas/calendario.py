from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.db.models.enums import TipoDiaOperativo


class EventoDiaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    nombre: str
    color_hex: str
    genera_extra_100: bool


class DiaCalendarioOut(BaseModel):
    fecha: date
    dia_semana: int          # 0=Lunes, 6=Domingo
    nombre_dia: str
    tipo_dia_operativo: TipoDiaOperativo
    es_fin_de_semana: bool
    es_feriado: bool
    cierra_colegio: bool
    color_hex: Optional[str]
    eventos: list[EventoDiaOut]


class MesCalendarioOut(BaseModel):
    anio: int
    mes: int
    dias: list[DiaCalendarioOut]
