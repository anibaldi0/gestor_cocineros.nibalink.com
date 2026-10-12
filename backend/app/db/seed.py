"""Seed idempotente de datos base del sistema.

Uso:
    docker exec -it gestion_cocina_backend python -m app.db.seed

Es seguro correrlo muchas veces: si un registro ya existe, no lo toca.
Si hay franjas viejas con nombres que ya no usamos, se eliminan junto
con sus reglas de cobertura asociadas.
"""

from __future__ import annotations

import argparse
import secrets
import string
from datetime import time

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.models.calendario import TipoEventoCalendario
from app.db.models.configuracion import Configuracion
from app.db.models.enums import (
    ContextoFranja,
    ModoConteo,
    Rol,
    TipoConfiguracion,
    TipoDiaOperativo,
)
from app.db.models.limpieza import TipoTareaLimpieza
from app.db.models.operativa import Franja, FranjaTipoDia, ReglaCobertura
from app.db.models.personas import Usuario, UsuarioRol
from app.db.session import SessionLocal

# Importar Base + todos los modelos para poblar el registry de SQLAlchemy
# ANTES de cualquier query. Sin esto, las relationships con string fallan.
from app.db import base as _models_registry  # noqa: F401


def _pass_random(largo: int = 14) -> str:
    alfabeto = string.ascii_letters + string.digits
    return "".join(secrets.choice(alfabeto) for _ in range(largo))


# ------------------------------------------------------------------
# Franjas base (10)
# ------------------------------------------------------------------
FRANJAS: list[dict] = [
    {
        "nombre": "LU_VIE_MANANA_7_15",
        "codigo_corto": "M",
        "contexto": ContextoFranja.LABORAL,
        "hora_inicio": time(7, 0),
        "hora_fin": time(15, 0),
        "tipos_dia": [
            TipoDiaOperativo.DIA_LABORAL_CON_COLEGIO,
            TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO,
        ],
        "orden": 10,
    },
    {
        "nombre": "LU_VIE_TARDE_12_20",
        "codigo_corto": "T",
        "contexto": ContextoFranja.LABORAL,
        "hora_inicio": time(12, 0),
        "hora_fin": time(20, 0),
        "tipos_dia": [
            TipoDiaOperativo.DIA_LABORAL_CON_COLEGIO,
            TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO,
        ],
        "orden": 20,
    },
    {
        "nombre": "FINDE_MANANA_7_12",
        "codigo_corto": "M",
        "contexto": ContextoFranja.FINDE,
        "hora_inicio": time(7, 0),
        "hora_fin": time(12, 0),
        "tipos_dia": [TipoDiaOperativo.FINDE_FERIADO],
        "orden": 30,
    },
    {
        "nombre": "FINDE_MANANA_7_15",
        "codigo_corto": "M",
        "contexto": ContextoFranja.FINDE,
        "hora_inicio": time(7, 0),
        "hora_fin": time(15, 0),
        "tipos_dia": [TipoDiaOperativo.FINDE_FERIADO],
        "orden": 40,
    },
    {
        "nombre": "FINDE_TARDE_11_19",
        "codigo_corto": "T",
        "contexto": ContextoFranja.FINDE,
        "hora_inicio": time(11, 0),
        "hora_fin": time(19, 0),
        "tipos_dia": [TipoDiaOperativo.FINDE_FERIADO],
        "orden": 50,
    },
    {
        "nombre": "FINDE_TARDE_14_19",
        "codigo_corto": "T",
        "contexto": ContextoFranja.FINDE,
        "hora_inicio": time(14, 0),
        "hora_fin": time(19, 0),
        "tipos_dia": [TipoDiaOperativo.FINDE_FERIADO],
        "orden": 60,
    },
    {
        "nombre": "FERIADO_MANANA_7_12",
        "codigo_corto": "M",
        "contexto": ContextoFranja.FERIADO,
        "hora_inicio": time(7, 0),
        "hora_fin": time(12, 0),
        "tipos_dia": [TipoDiaOperativo.FINDE_FERIADO],
        "orden": 70,
    },
    {
        "nombre": "FERIADO_MANANA_7_15",
        "codigo_corto": "M",
        "contexto": ContextoFranja.FERIADO,
        "hora_inicio": time(7, 0),
        "hora_fin": time(15, 0),
        "tipos_dia": [TipoDiaOperativo.FINDE_FERIADO],
        "orden": 80,
    },
    {
        "nombre": "FERIADO_TARDE_11_19",
        "codigo_corto": "T",
        "contexto": ContextoFranja.FERIADO,
        "hora_inicio": time(11, 0),
        "hora_fin": time(19, 0),
        "tipos_dia": [TipoDiaOperativo.FINDE_FERIADO],
        "orden": 90,
    },
    {
        "nombre": "FERIADO_TARDE_14_19",
        "codigo_corto": "T",
        "contexto": ContextoFranja.FERIADO,
        "hora_inicio": time(14, 0),
        "hora_fin": time(19, 0),
        "tipos_dia": [TipoDiaOperativo.FINDE_FERIADO],
        "orden": 100,
    },
]

# Nombres de franjas que existian en versiones anteriores y ya no se usan.
FRANJAS_OBSOLETAS: set[str] = {
    "COLEGIO_LV_7_15",
    "HOGAR_LV_MANANA_7_15",
    "HOGAR_LV_TARDE_12_20",
    "HOGAR_FINDE_MANANA_7_15",
    "HOGAR_FINDE_TARDE_11_19",
}

# (tipo_dia, nombre_franja, minima, ideal)
# Solo las franjas "8h" tienen regla canonica. Las variantes cortas
# (5h) suman horas pero no definen el minimo.
REGLAS_COBERTURA: list[tuple[TipoDiaOperativo, str, int, int]] = [
    (TipoDiaOperativo.DIA_LABORAL_CON_COLEGIO, "LU_VIE_MANANA_7_15", 2, 3),
    (TipoDiaOperativo.DIA_LABORAL_CON_COLEGIO, "LU_VIE_TARDE_12_20", 1, 2),
    (TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO, "LU_VIE_MANANA_7_15", 2, 3),
    (TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO, "LU_VIE_TARDE_12_20", 1, 2),
    (TipoDiaOperativo.FINDE_FERIADO, "FINDE_MANANA_7_15", 2, 3),
    (TipoDiaOperativo.FINDE_FERIADO, "FINDE_TARDE_11_19", 1, 2),
    (TipoDiaOperativo.FINDE_FERIADO, "FERIADO_MANANA_7_15", 2, 3),
    (TipoDiaOperativo.FINDE_FERIADO, "FERIADO_TARDE_11_19", 1, 2),
]

# ------------------------------------------------------------------
# Tipos de evento de calendario
# ------------------------------------------------------------------
TIPOS_EVENTO: list[dict] = [
    {
        "codigo": "FERIADO",
        "nombre": "Feriado",
        "afecta_colegio": True,
        "afecta_hogar": False,
        "genera_extra_100": True,
        "porcentaje_extra": 100.0,
        "color_hex": "#dc2626",
        "fuerza_tipo_dia_operativo": TipoDiaOperativo.FINDE_FERIADO,
    },
    {
        "codigo": "VACACIONES_ESCOLARES",
        "nombre": "Vacaciones escolares",
        "afecta_colegio": True,
        "afecta_hogar": False,
        "genera_extra_100": False,
        "porcentaje_extra": None,
        "color_hex": "#f59e0b",
        "fuerza_tipo_dia_operativo": TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO,
    },
    {
        "codigo": "RECESO_INVERNAL",
        "nombre": "Receso invernal",
        "afecta_colegio": True,
        "afecta_hogar": False,
        "genera_extra_100": False,
        "porcentaje_extra": None,
        "color_hex": "#0ea5e9",
        "fuerza_tipo_dia_operativo": TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO,
    },
    {
        "codigo": "RECESO_VERANO",
        "nombre": "Receso de verano",
        "afecta_colegio": True,
        "afecta_hogar": False,
        "genera_extra_100": False,
        "porcentaje_extra": None,
        "color_hex": "#0284c7",
        "fuerza_tipo_dia_operativo": TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO,
    },
    {
        "codigo": "CARNAVAL",
        "nombre": "Carnaval",
        "afecta_colegio": True,
        "afecta_hogar": False,
        "genera_extra_100": True,
        "porcentaje_extra": 100.0,
        "color_hex": "#a855f7",
        "fuerza_tipo_dia_operativo": TipoDiaOperativo.FINDE_FERIADO,
    },
    {
        "codigo": "SEMANA_SANTA",
        "nombre": "Semana Santa",
        "afecta_colegio": True,
        "afecta_hogar": False,
        "genera_extra_100": False,
        "porcentaje_extra": None,
        "color_hex": "#7c3aed",
        "fuerza_tipo_dia_operativo": TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO,
    },
]

# ------------------------------------------------------------------
# Tipos de tarea de limpieza
# ------------------------------------------------------------------
TIPOS_TAREA_LIMPIEZA: list[dict] = [
    {"codigo": "CAMARA", "nombre": "Camara", "color_hex": "#06b6d4"},
    {"codigo": "BANO", "nombre": "Bano", "color_hex": "#8b5cf6"},
    {"codigo": "SECTOR", "nombre": "Sector", "color_hex": "#22c55e"},
]

# ------------------------------------------------------------------
# Configuracion (umbrales de alertas)
# ------------------------------------------------------------------
CONFIGURACION: list[dict] = [
    ("alerta_dias_seguidos", "6", TipoConfiguracion.INT, "Dias seguidos trabajados antes de alertar", "alertas"),
    ("alerta_sin_franco_dias", "14", TipoConfiguracion.INT, "Dias sin franco antes de alertar", "alertas"),
    ("alerta_saldo_horas_positivo", "8", TipoConfiguracion.INT, "Saldo de horas a favor que dispara alerta", "alertas"),
    ("alerta_saldo_horas_negativo", "-8", TipoConfiguracion.INT, "Saldo de horas en deuda que dispara alerta", "alertas"),
    ("alerta_vacaciones_pendientes", "10", TipoConfiguracion.INT, "Dias de vacaciones pendientes antes de alertar", "alertas"),
    ("cobertura_minima_finde", "3", TipoConfiguracion.INT, "Guardia minima total en finde/feriado", "cobertura"),
    ("cobertura_minima_dia_habil", "4", TipoConfiguracion.INT, "Cobertura minima total en dia habil", "cobertura"),
    ("duracion_alerta_ignorada", "7", TipoConfiguracion.INT, "Dias que se oculta una alerta ignorada", "alertas"),
]


# ------------------------------------------------------------------
# Aplicadores idempotentes
# ------------------------------------------------------------------
def eliminar_franjas_obsoletas(db: Session) -> None:
    """Borra franjas viejas y sus reglas de cobertura. No toca turnos."""
    viejas = (
        db.query(Franja)
        .filter(Franja.nombre.in_(FRANJAS_OBSOLETAS))
        .all()
    )
    if not viejas:
        return
    ids = [f.id for f in viejas]
    # Borrar reglas primero (FK a franja)
    db.query(ReglaCobertura).filter(ReglaCobertura.franja_id.in_(ids)).delete(
        synchronize_session=False
    )
    db.query(FranjaTipoDia).filter(FranjaTipoDia.franja_id.in_(ids)).delete(
        synchronize_session=False
    )
    # No borramos los turnos: si hay turnos apuntando a franjas viejas,
    # la FK RESTRICT va a fallar. En ese caso avisamos.
    try:
        for f in viejas:
            db.delete(f)
        db.commit()
        print(f">> Franjas obsoletas eliminadas: {[f.nombre for f in viejas]}")
    except Exception as exc:
        db.rollback()
        print(f"!! No se pudieron borrar franjas obsoletas: {exc}")
        print("   Hay turnos apuntando a esas franjas. Se saltan.")


def seed_franjas(db: Session) -> None:
    existentes = {f.nombre: f for f in db.query(Franja).all()}
    for spec in FRANJAS:
        if spec["nombre"] in existentes:
            f = existentes[spec["nombre"]]
            f.codigo_corto = spec.get("codigo_corto")
            f.contexto = spec.get("contexto")
            continue
        franja = Franja(
            nombre=spec["nombre"],
            hora_inicio=spec["hora_inicio"],
            hora_fin=spec["hora_fin"],
            orden=spec["orden"],
            codigo_corto=spec.get("codigo_corto"),
            contexto=spec.get("contexto"),
            activa=True,
        )
        db.add(franja)
        db.flush()
        for td in spec["tipos_dia"]:
            db.add(FranjaTipoDia(franja_id=franja.id, tipo_dia_operativo=td))
    db.commit()


def seed_reglas_cobertura(db: Session) -> None:
    franjas = {f.nombre: f for f in db.query(Franja).all()}
    existentes = {
        (r.tipo_dia_operativo, r.franja_id)
        for r in db.query(ReglaCobertura).all()
    }
    for tipo_dia, franja_nombre, minima, ideal in REGLAS_COBERTURA:
        franja = franjas.get(franja_nombre)
        if franja is None:
            continue
        if (tipo_dia, franja.id) in existentes:
            continue
        db.add(
            ReglaCobertura(
                tipo_dia_operativo=tipo_dia,
                franja_id=franja.id,
                cantidad_minima=minima,
                cantidad_ideal=ideal,
                activo=True,
            )
        )
    db.commit()


def seed_tipos_evento(db: Session) -> None:
    existentes = {t.codigo: t for t in db.query(TipoEventoCalendario).all()}
    for spec in TIPOS_EVENTO:
        codigo = spec["codigo"]
        if codigo in existentes:
            t = existentes[codigo]
            for k, v in spec.items():
                if k == "codigo":
                    continue
                setattr(t, k, v)
        else:
            db.add(TipoEventoCalendario(**spec))
    db.commit()


def seed_tipos_tarea_limpieza(db: Session) -> None:
    existentes = {t.codigo: t for t in db.query(TipoTareaLimpieza).all()}
    for spec in TIPOS_TAREA_LIMPIEZA:
        codigo = spec["codigo"]
        if codigo in existentes:
            t = existentes[codigo]
            for k, v in spec.items():
                if k == "codigo":
                    continue
                setattr(t, k, v)
        else:
            db.add(TipoTareaLimpieza(**spec))
    db.commit()


def seed_configuracion(db: Session) -> None:
    existentes = {c.clave for c in db.query(Configuracion).all()}
    for clave, valor, tipo, desc, cat in CONFIGURACION:
        if clave in existentes:
            continue
        db.add(
            Configuracion(
                clave=clave,
                valor=valor,
                tipo=tipo,
                descripcion=desc,
                categoria=cat,
            )
        )
    db.commit()


def seed_superadmin(db: Session, username: str, password: str | None) -> str:
    existente = db.query(Usuario).filter(Usuario.username == username).one_or_none()
    if existente is not None:
        print(f">> El usuario '{username}' ya existe. No se toca.")
        return "<sin cambios>"

    final_pass = password or _pass_random()
    usuario = Usuario(
        username=username,
        password_hash=hash_password(final_pass),
        empleado_id=None,
        activo=True,
        debe_cambiar_password=True,
    )
    db.add(usuario)
    db.flush()
    db.add(UsuarioRol(usuario_id=usuario.id, rol=Rol.SUPERADMIN))
    db.commit()
    return final_pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed inicial del sistema")
    parser.add_argument("--admin-user", default="superadmin")
    parser.add_argument("--admin-pass", default=None)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        print(">> Eliminando franjas obsoletas...")
        eliminar_franjas_obsoletas(db)
        print(">> Sembrando franjas...")
        seed_franjas(db)
        print(">> Sembrando reglas de cobertura...")
        seed_reglas_cobertura(db)
        print(">> Sembrando tipos de evento...")
        seed_tipos_evento(db)
        print(">> Sembrando tipos de tarea de limpieza...")
        seed_tipos_tarea_limpieza(db)
        print(">> Sembrando configuracion...")
        seed_configuracion(db)

        print(">> Creando SUPERADMIN...")
        pwd = seed_superadmin(db, args.admin_user, args.admin_pass)
        if pwd != "<sin cambios>":
            print("")
            print("=" * 60)
            print(f"  USUARIO:  {args.admin_user}")
            print(f"  PASSWORD: {pwd}")
            print("  (debe_cambiar_password = True en el primer login)")
            print("=" * 60)
            print("")
        print(">> Seed completo.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
