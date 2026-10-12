from __future__ import annotations

from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.enums import (
    EstadoNovedad,
    EstadoTurno,
    EstadoVacacionesAnuales,
    ModoConteo,
    TipoAjusteHoras,
    TipoHoraExtra,
    TipoNovedad,
)
from app.db.session import Base


class Turno(Base):
    __tablename__ = "turno"
    __table_args__ = (
        # Un solo turno por empleado por dia (sin importar el estado).
        UniqueConstraint(
            "empleado_id",
            "fecha",
            name="uq_turno_empleado_fecha",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleado.id", ondelete="CASCADE"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    franja_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("franja.id", ondelete="RESTRICT")
    )
    estado: Mapped[EstadoTurno] = mapped_column(
        SAEnum(EstadoTurno, name="estado_turno_enum"), nullable=False
    )
    horas: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    horas_extra: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=0, server_default="0"
    )
    es_franco_protegido: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    nota: Mapped[Optional[str]] = mapped_column(String(200))

    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    empleado: Mapped["Empleado"] = relationship(back_populates="turnos")  # type: ignore[name-defined]
    franja: Mapped[Optional["Franja"]] = relationship()  # type: ignore[name-defined]


class Novedad(Base):
    __tablename__ = "novedad"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleado.id", ondelete="CASCADE"), nullable=False
    )
    tipo: Mapped[TipoNovedad] = mapped_column(
        SAEnum(TipoNovedad, name="tipo_novedad_enum"), nullable=False
    )
    desde: Mapped[date] = mapped_column(Date, nullable=False)
    hasta: Mapped[date] = mapped_column(Date, nullable=False)
    dias_solicitados: Mapped[int] = mapped_column(Integer, nullable=False)
    dias_computados: Mapped[int] = mapped_column(Integer, nullable=False)
    anio_vacacional: Mapped[Optional[int]] = mapped_column(Integer)
    observacion: Mapped[Optional[str]] = mapped_column(Text)
    estado: Mapped[EstadoNovedad] = mapped_column(
        SAEnum(EstadoNovedad, name="estado_novedad_enum"),
        nullable=False,
        default=EstadoNovedad.ACTIVA,
    )
    creada_por: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    empleado: Mapped["Empleado"] = relationship(back_populates="novedades")  # type: ignore[name-defined]


class VacacionesAnuales(Base):
    __tablename__ = "vacaciones_anuales"
    __table_args__ = (
        CheckConstraint("dias_totales >= 0", name="ck_vac_totales_pos"),
    )

    anio: Mapped[int] = mapped_column(Integer, primary_key=True)
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleado.id", ondelete="CASCADE"), primary_key=True
    )
    dias_totales: Mapped[int] = mapped_column(Integer, nullable=False)
    modo_conteo: Mapped[ModoConteo] = mapped_column(
        SAEnum(ModoConteo, name="modo_conteo_enum"), nullable=False
    )
    estado: Mapped[EstadoVacacionesAnuales] = mapped_column(
        SAEnum(EstadoVacacionesAnuales, name="estado_vacaciones_anuales_enum"),
        nullable=False,
        default=EstadoVacacionesAnuales.ABIERTA,
    )
    dias_arrastrados: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    observacion: Mapped[Optional[str]] = mapped_column(Text)
    cargado_por: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    fecha_carga: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    cerrado_por: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    fecha_cierre: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    empleado: Mapped["Empleado"] = relationship(back_populates="vacaciones")  # type: ignore[name-defined]


class HoraExtra(Base):
    __tablename__ = "hora_extra"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleado.id", ondelete="CASCADE"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    hora_fin: Mapped[time] = mapped_column(Time, nullable=False)
    horas_calculadas: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    tipo: Mapped[TipoHoraExtra] = mapped_column(
        SAEnum(TipoHoraExtra, name="tipo_hora_extra_enum"), nullable=False
    )
    motivo: Mapped[Optional[str]] = mapped_column(Text)
    cargada_por: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    fecha_carga: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    empleado: Mapped["Empleado"] = relationship(back_populates="horas_extra")  # type: ignore[name-defined]


class AjusteHoras(Base):
    __tablename__ = "ajuste_horas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleado.id", ondelete="CASCADE"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    tipo: Mapped[TipoAjusteHoras] = mapped_column(
        SAEnum(TipoAjusteHoras, name="tipo_ajuste_horas_enum"), nullable=False
    )
    horas: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    motivo: Mapped[Optional[str]] = mapped_column(Text)
    cargado_por: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    fecha_carga: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    referencia_id: Mapped[Optional[int]] = mapped_column(Integer)

    empleado: Mapped["Empleado"] = relationship(back_populates="ajustes")  # type: ignore[name-defined]
