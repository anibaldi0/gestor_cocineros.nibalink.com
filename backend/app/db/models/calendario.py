from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.enums import TipoDiaOperativo
from app.db.session import Base


class TipoEventoCalendario(Base):
    __tablename__ = "tipo_evento_calendario"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    afecta_colegio: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    afecta_hogar: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    genera_extra_100: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    porcentaje_extra: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    color_hex: Mapped[str] = mapped_column(String(7), nullable=False, default="#cccccc")
    fuerza_tipo_dia_operativo: Mapped[Optional[TipoDiaOperativo]] = mapped_column(
        SAEnum(TipoDiaOperativo, name="tipo_dia_operativo_enum")
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    eventos: Mapped[list["EventoCalendario"]] = relationship(back_populates="tipo_evento")


class EventoCalendario(Base):
    __tablename__ = "evento_calendario"
    __table_args__ = (
        CheckConstraint("hasta >= desde", name="ck_evento_rango_valido"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipo_evento_id: Mapped[int] = mapped_column(
        ForeignKey("tipo_evento_calendario.id", ondelete="RESTRICT"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    desde: Mapped[date] = mapped_column(Date, nullable=False)
    hasta: Mapped[date] = mapped_column(Date, nullable=False)
    anio: Mapped[int] = mapped_column(Integer, nullable=False)
    observacion: Mapped[Optional[str]] = mapped_column(Text)
    creado_por: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actualizado_por: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    fecha_actualizacion: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True)
    )

    tipo_evento: Mapped["TipoEventoCalendario"] = relationship(back_populates="eventos")
