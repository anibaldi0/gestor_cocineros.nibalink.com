from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Auditoria(Base):
    """Append-only. Nunca se hace UPDATE ni DELETE desde la app."""

    __tablename__ = "auditoria"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    accion: Mapped[str] = mapped_column(String(80), nullable=False)
    entidad: Mapped[str] = mapped_column(String(60), nullable=False)
    entidad_id: Mapped[Optional[int]] = mapped_column(Integer)
    antes_json: Mapped[Optional[dict]] = mapped_column(JSONB)
    despues_json: Mapped[Optional[dict]] = mapped_column(JSONB)
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    modo_activo: Mapped[Optional[str]] = mapped_column(String(20))
    alertas_pendientes: Mapped[Optional[str]] = mapped_column(Text)
    doble_confirmacion: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
