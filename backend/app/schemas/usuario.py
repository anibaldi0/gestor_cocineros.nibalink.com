from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models.enums import Rol


def _normalizar_username(v: object) -> object:
    if isinstance(v, str):
        return v.strip().lower()
    return v


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    empleado_id: Optional[int]
    activo: bool
    debe_cambiar_password: bool
    fecha_creacion: datetime


class UsuarioDetalleOut(UsuarioOut):
    roles: list[Rol]
    empleado_nombre: Optional[str] = None


class UsuarioMeOut(UsuarioOut):
    roles: list[Rol]
    modo_activo: Optional[Rol] = None


class UsuarioCreate(BaseModel):
    username: str = Field(min_length=3, max_length=60)
    rol: Rol
    empleado_id: Optional[int] = None
    # Si password es None, el backend genera una aleatoria y la devuelve
    # una sola vez en la respuesta.
    password: Optional[str] = Field(default=None, min_length=6, max_length=100)

    @field_validator("username", mode="before")
    @classmethod
    def _v_username(cls, v: object) -> object:
        return _normalizar_username(v)


class UsuarioCreateOut(UsuarioDetalleOut):
    """Respuesta al crear un usuario. Si password_autogenerada es True,
    el campo password_temporal muestra la generada. Solo se devuelve
    en esta respuesta; no se puede recuperar despues."""

    password_autogenerada: bool = False
    password_temporal: Optional[str] = None


class UsuarioUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=60)
    rol: Optional[Rol] = None
    empleado_id: Optional[int] = None
    activo: Optional[bool] = None

    @field_validator("username", mode="before")
    @classmethod
    def _v_username(cls, v: object) -> object:
        return _normalizar_username(v)


class ResetPasswordIn(BaseModel):
    # Si password es None, el backend genera una aleatoria.
    password: Optional[str] = Field(default=None, min_length=6, max_length=100)


class ResetPasswordOut(BaseModel):
    usuario_id: int
    username: str
    password_temporal: str
    debe_cambiar_password: bool


class ChangePasswordIn(BaseModel):
    password_actual: str = Field(min_length=1, max_length=200)
    password_nueva: str = Field(min_length=6, max_length=100)
