from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.fechas_parse import parse_fecha
from app.core.normalizacion import (
    normalizar_dni,
    normalizar_nombre,
    normalizar_telefono,
    normalizar_texto_libre,
)


def _parse_fecha_opcional(v: object) -> object:
    if v is None or v == "":
        return None
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        return parse_fecha(v)
    return v


class EmpleadoBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    dni: str = Field(min_length=6, max_length=10)
    fecha_nacimiento: Optional[date] = None
    telefono: Optional[str] = Field(default=None, max_length=40)
    fecha_ingreso: date
    tipo_contrato: Optional[str] = Field(default=None, max_length=50)
    horas_semana_max: int = Field(default=40, ge=1, le=168)
    observaciones: Optional[str] = None

    @field_validator("nombre", "apellido", mode="before")
    @classmethod
    def _v_nombre(cls, v: object) -> object:
        if isinstance(v, str):
            return normalizar_nombre(v)
        return v

    @field_validator("dni", mode="before")
    @classmethod
    def _v_dni(cls, v: object) -> object:
        if isinstance(v, str):
            return normalizar_dni(v)
        return v

    @field_validator("telefono", mode="before")
    @classmethod
    def _v_tel(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return normalizar_telefono(v)
        return v

    @field_validator("tipo_contrato", "observaciones", mode="before")
    @classmethod
    def _v_texto(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return normalizar_texto_libre(v)
        return v

    @field_validator("fecha_ingreso", "fecha_nacimiento", mode="before")
    @classmethod
    def _v_fecha(cls, v: object) -> object:
        return _parse_fecha_opcional(v)


class EmpleadoCreate(EmpleadoBase):
    pass


class EmpleadoUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=100)
    apellido: Optional[str] = Field(default=None, min_length=1, max_length=100)
    dni: Optional[str] = Field(default=None, min_length=6, max_length=10)
    fecha_nacimiento: Optional[date] = None
    telefono: Optional[str] = Field(default=None, max_length=40)
    fecha_ingreso: Optional[date] = None
    tipo_contrato: Optional[str] = Field(default=None, max_length=50)
    horas_semana_max: Optional[int] = Field(default=None, ge=1, le=168)
    observaciones: Optional[str] = None
    activo: Optional[bool] = None
    fecha_baja: Optional[date] = None

    @field_validator("nombre", "apellido", mode="before")
    @classmethod
    def _v_nombre(cls, v: object) -> object:
        if isinstance(v, str):
            return normalizar_nombre(v)
        return v

    @field_validator("dni", mode="before")
    @classmethod
    def _v_dni(cls, v: object) -> object:
        if isinstance(v, str):
            return normalizar_dni(v)
        return v

    @field_validator("telefono", mode="before")
    @classmethod
    def _v_tel(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return normalizar_telefono(v)
        return v

    @field_validator("tipo_contrato", "observaciones", mode="before")
    @classmethod
    def _v_texto(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return normalizar_texto_libre(v)
        return v

    @field_validator(
        "fecha_ingreso", "fecha_nacimiento", "fecha_baja", mode="before"
    )
    @classmethod
    def _v_fecha(cls, v: object) -> object:
        return _parse_fecha_opcional(v)


class EmpleadoUsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    activo: bool
    debe_cambiar_password: bool


class EmpleadoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    apellido: str
    dni: str
    fecha_nacimiento: Optional[date] = None
    telefono: Optional[str] = None
    fecha_ingreso: date
    tipo_contrato: Optional[str] = None
    horas_semana_max: int
    observaciones: Optional[str] = None
    activo: bool
    fecha_baja: Optional[date] = None
    usuario: Optional[EmpleadoUsuarioOut] = None


class EmpleadoReactivarIn(BaseModel):
    """Payload para reactivar un empleado.

    Si el empleado tiene un usuario vinculado que quedo inactivo, se puede
    actualizar el username y/o la password desde aca. Si no se manda
    password, se genera una temporal y se devuelve una sola vez.
    """

    # Campos del empleado (opcionales, igual que en EmpleadoUpdate)
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=100)
    apellido: Optional[str] = Field(default=None, min_length=1, max_length=100)
    dni: Optional[str] = Field(default=None, min_length=6, max_length=10)
    fecha_nacimiento: Optional[date] = None
    telefono: Optional[str] = Field(default=None, max_length=40)
    tipo_contrato: Optional[str] = Field(default=None, max_length=50)
    horas_semana_max: Optional[int] = Field(default=None, ge=1, le=168)
    observaciones: Optional[str] = None

    # Credenciales del usuario (opcionales)
    nuevo_username: Optional[str] = Field(default=None, min_length=3, max_length=60)
    nueva_password: Optional[str] = Field(default=None, min_length=6, max_length=100)

    @field_validator("nombre", "apellido", mode="before")
    @classmethod
    def _v_nombre(cls, v: object) -> object:
        if isinstance(v, str):
            return normalizar_nombre(v)
        return v

    @field_validator("dni", mode="before")
    @classmethod
    def _v_dni(cls, v: object) -> object:
        if isinstance(v, str):
            return normalizar_dni(v)
        return v

    @field_validator("telefono", mode="before")
    @classmethod
    def _v_tel(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return normalizar_telefono(v)
        return v

    @field_validator("tipo_contrato", "observaciones", mode="before")
    @classmethod
    def _v_texto(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return normalizar_texto_libre(v)
        return v

    @field_validator(
        "fecha_nacimiento", mode="before"
    )
    @classmethod
    def _v_fecha(cls, v: object) -> object:
        return _parse_fecha_opcional(v)

    @field_validator("nuevo_username", mode="before")
    @classmethod
    def _v_username(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().lower()
        return v
