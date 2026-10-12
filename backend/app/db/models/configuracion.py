from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.enums import TipoConfiguracion
from app.db.session import Base


class Configuracion(Base):
    __tablename__ = "configuracion"

    clave: Mapped[str] = mapped_column(String(80), primary_key=True)
    valor: Mapped[str] = mapped_column(Text, nullable=False)
    tipo: Mapped[TipoConfiguracion] = mapped_column(
        SAEnum(TipoConfiguracion, name="tipo_configuracion_enum"),
        nullable=False,
        default=TipoConfiguracion.STRING,
    )
    descripcion: Mapped[Optional[str]] = mapped_column(Text)
    categoria: Mapped[Optional[str]] = mapped_column(String(60))
    actualizada_por: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    fecha_actualizacion: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True)
    )
