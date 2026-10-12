from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.enums import EstadoAlerta
from app.db.session import Base


class AlertaGenerada(Base):
    __tablename__ = "alerta_generada"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipo: Mapped[str] = mapped_column(String(60), nullable=False)
    empleado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleado.id", ondelete="SET NULL")
    )
    fecha_referencia: Mapped[Optional[date]] = mapped_column(Date)
    estado: Mapped[EstadoAlerta] = mapped_column(
        SAEnum(EstadoAlerta, name="estado_alerta_enum"),
        nullable=False,
        default=EstadoAlerta.ACTIVA,
    )
    resuelta_por: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    fecha_resolucion: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    motivo_ignorada: Mapped[Optional[str]] = mapped_column(Text)
    fecha_fin_ignorada: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
