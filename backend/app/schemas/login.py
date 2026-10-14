from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class LoginEventoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: datetime


class LoginsUsuarioOut(BaseModel):
    usuario_id: int
    username: str
    total: int
    ultimo_login: Optional[datetime] = None
    eventos: list[LoginEventoOut]


class ResumenLoginOut(BaseModel):
    usuario_id: int
    total: int
    ultimo_login: Optional[datetime] = None
