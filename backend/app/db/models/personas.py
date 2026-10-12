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

from app.db.models.enums import Rol
from app.db.session import Base

if TYPE_CHECKING:
    from app.db.models.jornada import AjusteHoras, HoraExtra, Novedad, Turno, VacacionesAnuales
    from app.db.models.limpieza import AsignacionLimpieza, ColaLimpieza


class Empleado(Base):
    __tablename__ = "empleado"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    apellido: Mapped[str] = mapped_column(String(100), nullable=False)
    dni: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    fecha_nacimiento: Mapped[Optional[date]] = mapped_column(Date)
    telefono: Mapped[Optional[str]] = mapped_column(String(40))
    fecha_ingreso: Mapped[date] = mapped_column(Date, nullable=False)
    tipo_contrato: Mapped[Optional[str]] = mapped_column(String(50))
    horas_semana_max: Mapped[int] = mapped_column(Integer, nullable=False, default=40)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    fecha_baja: Mapped[Optional[date]] = mapped_column(Date)
    observaciones: Mapped[Optional[str]] = mapped_column(Text)

    usuario: Mapped[Optional["Usuario"]] = relationship(
        back_populates="empleado", uselist=False
    )
    turnos: Mapped[list["Turno"]] = relationship(back_populates="empleado")
    novedades: Mapped[list["Novedad"]] = relationship(back_populates="empleado")
    vacaciones: Mapped[list["VacacionesAnuales"]] = relationship(back_populates="empleado")
    horas_extra: Mapped[list["HoraExtra"]] = relationship(back_populates="empleado")
    ajustes: Mapped[list["AjusteHoras"]] = relationship(back_populates="empleado")
    asignaciones_limpieza: Mapped[list["AsignacionLimpieza"]] = relationship(
        back_populates="empleado"
    )
    colas_limpieza: Mapped[list["ColaLimpieza"]] = relationship(back_populates="empleado")


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    empleado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleado.id", ondelete="SET NULL"), unique=True
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    debe_cambiar_password: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    creado_por: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL")
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    empleado: Mapped[Optional["Empleado"]] = relationship(back_populates="usuario")
    roles: Mapped[list["UsuarioRol"]] = relationship(
        back_populates="usuario", cascade="all, delete-orphan"
    )


class UsuarioRol(Base):
    __tablename__ = "usuario_rol"

    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuario.id", ondelete="CASCADE"), primary_key=True
    )
    rol: Mapped[Rol] = mapped_column(
        SAEnum(Rol, name="rol_enum"), primary_key=True
    )

    usuario: Mapped["Usuario"] = relationship(back_populates="roles")
