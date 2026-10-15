from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel

from app.db.models.enums import (
    ContextoFranja,
    EstadoTurno,
    TipoDiaOperativo,
)
from app.schemas.calendario import EventoDiaOut


class DiaGrillaOut(BaseModel):
    fecha: date
    dia_semana: int
    nombre_dia: str
    tipo_dia_operativo: TipoDiaOperativo
    es_fin_de_semana: bool
    es_feriado: bool
    cierra_colegio: bool
    color_hex: Optional[str]
    eventos: list[EventoDiaOut]


class EmpleadoGrillaOut(BaseModel):
    id: int
    nombre: str
    apellido: str
    activo: bool
    horas_semana_max: int


class TurnoGrillaOut(BaseModel):
    id: int
    empleado_id: int
    fecha: date
    franja_id: Optional[int]
    franja_nombre: Optional[str]
    codigo_corto: Optional[str]
    hora_inicio: Optional[str]
    hora_fin: Optional[str]
    estado: EstadoTurno
    horas: float
    horas_extra: float
    es_franco_protegido: bool
    nota: Optional[str]


class CoberturaDiaOut(BaseModel):
    fecha: date
    franja_id: int
    franja_nombre: str
    codigo_corto: Optional[str]
    contexto: ContextoFranja
    actual: int
    minima: int
    ideal: int
    estado: str  # CUBIERTO_OK | CUBIERTO_JUSTO | HUECO


class AlertaDiaOut(BaseModel):
    fecha: date
    franja_id: int
    franja_nombre: str
    nivel: str  # AMARILLO | ROJO
    mensaje: str


class EstadoDiaOut(BaseModel):
    """Estado agregado de un dia, para pintar el badge del encabezado."""

    fecha: date
    estado: str  # OK | AMARILLO | ROJO
    alertas: int


class AsignacionLimpiezaGrillaOut(BaseModel):
    id: int
    empleado_id: int
    fecha: date
    tipo_tarea_id: int
    tipo_tarea_codigo: str
    tipo_tarea_nombre: str
    tipo_tarea_color: str


class GrillaMesOut(BaseModel):
    anio: int
    mes: int
    estado_periodo: str = 'BORRADOR'
    dias: list[DiaGrillaOut]
    empleados: list[EmpleadoGrillaOut]
    turnos: list[TurnoGrillaOut]
    cobertura: list[CoberturaDiaOut]
    alertas: list[AlertaDiaOut]
    estado_por_dia: list[EstadoDiaOut]
    limpieza: list[AsignacionLimpiezaGrillaOut] = []


class RellenoHuecosOut(BaseModel):
    anio: int
    mes: int
    empleados: int
    dias_habiles: int
    creados: int
