from __future__ import annotations

from datetime import time
from typing import Optional

from sqlalchemy import (
    Boolean,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.enums import ContextoFranja, TipoDiaOperativo
from app.db.session import Base


class Franja(Base):
    __tablename__ = "franja"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    hora_fin: Mapped[time] = mapped_column(Time, nullable=False)
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    codigo_corto: Mapped[Optional[str]] = mapped_column(String(3))
    contexto: Mapped[Optional[ContextoFranja]] = mapped_column(
        SAEnum(ContextoFranja, name="contexto_franja_enum")
    )

    tipos_dia: Mapped[list["FranjaTipoDia"]] = relationship(
        back_populates="franja", cascade="all, delete-orphan"
    )
    reglas_cobertura: Mapped[list["ReglaCobertura"]] = relationship(back_populates="franja")


class FranjaTipoDia(Base):
    __tablename__ = "franja_tipo_dia"

    franja_id: Mapped[int] = mapped_column(
        ForeignKey("franja.id", ondelete="CASCADE"), primary_key=True
    )
    tipo_dia_operativo: Mapped[TipoDiaOperativo] = mapped_column(
        SAEnum(TipoDiaOperativo, name="tipo_dia_operativo_enum"), primary_key=True
    )

    franja: Mapped["Franja"] = relationship(back_populates="tipos_dia")


class ReglaCobertura(Base):
    __tablename__ = "regla_cobertura"
    __table_args__ = (
        UniqueConstraint(
            "tipo_dia_operativo", "franja_id", name="uq_regla_tipo_franja"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipo_dia_operativo: Mapped[TipoDiaOperativo] = mapped_column(
        SAEnum(TipoDiaOperativo, name="tipo_dia_operativo_enum"), nullable=False
    )
    franja_id: Mapped[int] = mapped_column(
        ForeignKey("franja.id", ondelete="CASCADE"), nullable=False
    )
    cantidad_minima: Mapped[int] = mapped_column(Integer, nullable=False)
    cantidad_ideal: Mapped[int] = mapped_column(Integer, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    franja: Mapped["Franja"] = relationship(back_populates="reglas_cobertura")
