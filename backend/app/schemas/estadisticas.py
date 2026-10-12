from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class StatsEmpleadoMesOut(BaseModel):
    empleado_id: int
    nombre: str
    apellido: str
    dni: str
    horas_semana_max: int
    dias_trabajados: int
    dias_franco: int
    dias_vacaciones: int
    dias_licencia: int
    dias_ausencia: int
    horas_trabajadas: float
    horas_extra: float
    horas_totales: float
    dias_con_he: int


class StatsAgregadasMesOut(BaseModel):
    dias_totales_mes: int
    dias_con_alerta_roja: int
    dias_con_alerta_amarilla: int
    empleados_activos: int
    horas_totales_plantel: float
    horas_extra_totales: float


class StatsMesOut(BaseModel):
    anio: int
    mes: int
    empleados: list[StatsEmpleadoMesOut]
    agregadas: StatsAgregadasMesOut


class StatsMesResumenOut(BaseModel):
    mes: int
    agregadas: StatsAgregadasMesOut


class StatsAnioOut(BaseModel):
    anio: int
    empleados: list[StatsEmpleadoMesOut]
    agregadas: StatsAgregadasMesOut
    por_mes: list[StatsMesResumenOut]


class StatsAnioResumenOut(BaseModel):
    anio: int
    agregadas: StatsAgregadasMesOut


class StatsHistoricoOut(BaseModel):
    anios: list[StatsAnioResumenOut]
    total_empleados_distintos: int
