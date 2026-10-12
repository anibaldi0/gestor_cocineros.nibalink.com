from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.db.models.enums import EstadoTurno
from app.schemas.limpieza import LimpiezaEmpleadoOut


class EmpleadoInfoOut(BaseModel):
    id: int
    nombre: str
    apellido: str
    fecha_ingreso: date
    horas_semana_max: int


class StatsMesOut(BaseModel):
    dias_trabajados: int
    francos: int
    vacaciones_tomadas: int
    licencias: int
    horas_totales: float
    horas_extra: float
    dias_con_he: int
    horas_trabajadas_mas_he: float
    saldo_horas: float


class FrancosMesOut(BaseModel):
    fecha: date
    es_franco_protegido: bool
    nota: Optional[str]


class FeriadoTrabajadoOut(BaseModel):
    fecha: date
    nombre_evento: str
    estado: EstadoTurno
    horas: float
    codigo_corto: Optional[str]


class TurnoMesOut(BaseModel):
    fecha: date
    estado: EstadoTurno
    horas: float
    horas_extra: float
    franja_nombre: Optional[str]
    codigo_corto: Optional[str]
    hora_inicio: Optional[str]
    hora_fin: Optional[str]
    es_franco_protegido: bool
    nota: Optional[str]


class DashboardEmpleadoOut(BaseModel):
    empleado: EmpleadoInfoOut
    anio: int
    mes: int
    stats: StatsMesOut
    francos: list[FrancosMesOut]
    feriados_trabajados: list[FeriadoTrabajadoOut]
    turnos: list[TurnoMesOut]
    # Placeholder para el proximo chunk de limpieza
    limpieza: list[LimpiezaEmpleadoOut] = []
