from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.enums import (
    EstadoCicloLimpieza,
    EstadoColaLimpieza,
    OrigenAsignacionLimpieza,
)
from app.db.session import Base



if TYPE_CHECKING:
    from app.db.models.personas import Empleado


class TipoTareaLimpieza(Base):
    __tablename__ = "tipo_tarea_limpieza"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    color_hex: Mapped[str] = mapped_column(
        String(7), nullable=False, default="#94a3b8"
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ColaLimpieza(Base):
    __tablename__ = "cola_limpieza"
    __table_args__ = (
        UniqueConstraint("tipo_tarea_id", "empleado_id", name="uq_cola_tipo_empleado"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipo_tarea_id: Mapped[int] = mapped_column(
        ForeignKey("tipo_tarea_limpieza.id", ondelete="CASCADE"), nullable=False
    )
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleado.id", ondelete="CASCADE"), nullable=False
    )
    posicion: Mapped[int] = mapped_column(Integer, nullable=False)
    estado: Mapped[EstadoColaLimpieza] = mapped_column(
        SAEnum(EstadoColaLimpieza, name="estado_cola_limpieza_enum"),
        nullable=False,
        default=EstadoColaLimpieza.EN_COLA,
    )
    motivo_pausa: Mapped[Optional[str]] = mapped_column(Text)
    fecha_ultima_asignacion: Mapped[Optional[date]] = mapped_column(Date)
    fecha_ingreso_cola: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    empleado: Mapped["Empleado"] = relationship(back_populates="colas_limpieza")  # type: ignore[name-defined]


class AsignacionLimpieza(Base):
    __tablename__ = "asignacion_limpieza"
    __table_args__ = (
        UniqueConstraint("fecha", "empleado_id", name="uq_asig_fecha_empleado"),
        UniqueConstraint("fecha", "tipo_tarea_id", name="uq_asig_fecha_tipo_tarea"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleado.id", ondelete="CASCADE"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    tipo_tarea_id: Mapped[int] = mapped_column(
        ForeignKey("tipo_tarea_limpieza.id", ondelete="RESTRICT"), nullable=False
    )
    origen: Mapped[OrigenAsignacionLimpieza] = mapped_column(
        SAEnum(OrigenAsignacionLimpieza, name="origen_asignacion_limpieza_enum"),
        nullable=False,
        default=OrigenAsignacionLimpieza.AUTO,
    )
    observacion: Mapped[Optional[str]] = mapped_column(Text)
    asignada_por: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    fecha_asignacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    empleado: Mapped["Empleado"] = relationship(back_populates="asignaciones_limpieza")  # type: ignore[name-defined]
    tipo_tarea: Mapped["TipoTareaLimpieza"] = relationship()  # type: ignore[name-defined]


class CicloLimpieza(Base):
    __tablename__ = "ciclo_limpieza"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipo_tarea_id: Mapped[int] = mapped_column(
        ForeignKey("tipo_tarea_limpieza.id", ondelete="CASCADE"), nullable=False
    )
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[Optional[date]] = mapped_column(Date)
    estado: Mapped[EstadoCicloLimpieza] = mapped_column(
        SAEnum(EstadoCicloLimpieza, name="estado_ciclo_limpieza_enum"),
        nullable=False,
        default=EstadoCicloLimpieza.ABIERTO,
    )
