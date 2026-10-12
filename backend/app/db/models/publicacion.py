from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.enums import EstadoPeriodoGrilla
from app.db.session import Base


class PeriodoGrilla(Base):
    __tablename__ = "periodo_grilla"
    __table_args__ = (
        UniqueConstraint("anio", "mes", name="uq_periodo_anio_mes"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    anio: Mapped[int] = mapped_column(Integer, nullable=False)
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    estado: Mapped[EstadoPeriodoGrilla] = mapped_column(
        SAEnum(EstadoPeriodoGrilla, name="estado_periodo_grilla_enum"),
        nullable=False,
        default=EstadoPeriodoGrilla.BORRADOR,
    )
    fecha_publicacion: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    publicado_por: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
