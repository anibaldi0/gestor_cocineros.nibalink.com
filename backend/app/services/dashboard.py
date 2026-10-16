"""Servicio del dashboard personal del empleado.

Devuelve solo la informacion del empleado logueado para el mes en curso
o el mes pedido. No expone datos de otros empleados ni semaforo de
gestion.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.db.models.jornada import Turno
from app.services.publicacion import get_periodo
from app.db.models.limpieza import AsignacionLimpieza
from app.db.models.personas import Empleado, Usuario
from app.schemas.limpieza import LimpiezaEmpleadoOut
from app.schemas.dashboard import (
    DashboardEmpleadoOut,
    EmpleadoInfoOut,
    FeriadoTrabajadoOut,
    FrancosMesOut,
    StatsMesOut,
    TurnoMesOut,
)
from app.services.calendario import (
    eventos_activos_en,
    eventos_del_mes,
)
from app.services.fechas import rango_mes


def _stats_del_mes(
    turnos: list[Turno], horas_semana_max: int
) -> StatsMesOut:
    """Calcula las estadisticas del mes a partir de los turnos."""
    dias_trabajados = 0
    francos = 0
    vacaciones = 0
    licencias = 0
    horas_totales = 0.0
    horas_extra = 0.0
    dias_con_he = 0

    for t in turnos:
        if t.estado == "TRABAJO":
            dias_trabajados += 1
            horas_totales += float(t.horas)
        elif t.estado == "FRANCO":
            francos += 1
        elif t.estado == "VACACIONES":
            vacaciones += 1
        elif t.estado in (
            "LICENCIA_MEDICA",
            "ART",
            "LICENCIA_ESPECIAL",
        ):
            licencias += 1
        he = float(t.horas_extra)
        if he > 0:
            horas_extra += he
            dias_con_he += 1

    return StatsMesOut(
        dias_trabajados=dias_trabajados,
        francos=francos,
        vacaciones_tomadas=vacaciones,
        licencias=licencias,
        horas_totales=round(horas_totales, 2),
        horas_extra=round(horas_extra, 2),
        dias_con_he=dias_con_he,
        horas_trabajadas_mas_he=round(horas_totales + horas_extra, 2),
        saldo_horas=0.0,
    )


def construir_dashboard(
    db: Session, usuario: Usuario, anio: int, mes: int
) -> DashboardEmpleadoOut:
    """Arma el dashboard personal del empleado logueado."""

    if usuario.empleado_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario no esta vinculado a un empleado",
        )

    empleado = db.get(Empleado, usuario.empleado_id)
    if empleado is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empleado no encontrado",
        )

    primero, ultimo = rango_mes(anio, mes)

    # Traer turnos del mes
    turnos = (
        db.query(Turno)
        .options(joinedload(Turno.franja))
        .filter(Turno.empleado_id == empleado.id)
        .filter(Turno.fecha >= primero)
        .filter(Turno.fecha <= ultimo)
        .order_by(Turno.fecha)
        .all()
    )

    # Turnos de salida
    turnos_out: list[TurnoMesOut] = []
    for t in turnos:
        fr = t.franja
        turnos_out.append(
            TurnoMesOut(
                fecha=t.fecha,
                estado=t.estado,
                horas=float(t.horas),
                horas_extra=float(t.horas_extra),
                franja_nombre=fr.nombre if fr else None,
                codigo_corto=fr.codigo_corto if fr else None,
                hora_inicio=fr.hora_inicio.strftime("%H:%M") if fr else None,
                hora_fin=fr.hora_fin.strftime("%H:%M") if fr else None,
                es_franco_protegido=t.es_franco_protegido,
                nota=t.nota,
            )
        )

    # Francos del mes
    francos = [
        FrancosMesOut(
            fecha=t.fecha,
            es_franco_protegido=t.es_franco_protegido,
            nota=t.nota,
        )
        for t in turnos
        if t.estado == "FRANCO"
    ]

    # Feriados que trabaja (eventos activos + turno TRABAJO en ese dia)
    eventos = eventos_del_mes(db, anio, mes)
    turnos_por_fecha = {t.fecha: t for t in turnos}
    feriados_trabajados: list[FeriadoTrabajadoOut] = []
    for f in [t.fecha for t in turnos]:
        activos = eventos_activos_en(f, eventos)
        feriados = [e for e in activos if e.genera_extra_100]
        if not feriados:
            continue
        t = turnos_por_fecha.get(f)
        if t is None or t.estado != "TRABAJO":
            continue
        fr = t.franja
        feriados_trabajados.append(
            FeriadoTrabajadoOut(
                fecha=f,
                nombre_evento=feriados[0].nombre,
                estado=t.estado,
                horas=float(t.horas),
                codigo_corto=fr.codigo_corto if fr else None,
            )
        )

    # Stats
    stats = _stats_del_mes(turnos, empleado.horas_semana_max)

    # Asignaciones de limpieza del mes
    limpieza_rows = (
        db.query(AsignacionLimpieza)
        .options(joinedload(AsignacionLimpieza.tipo_tarea))
        .filter(AsignacionLimpieza.empleado_id == empleado.id)
        .filter(AsignacionLimpieza.fecha >= primero)
        .filter(AsignacionLimpieza.fecha <= ultimo)
        .order_by(AsignacionLimpieza.fecha)
        .all()
    )
    hoy = datetime.now(tz=timezone.utc).date()

    def _puede_firmar(fecha: date, firmada_at) -> bool:
        if firmada_at is not None:
            return False
        delta = (hoy - fecha).days
        return 0 <= delta <= 7

    limpieza_out = [
        LimpiezaEmpleadoOut(
            id=r.id,
            fecha=r.fecha,
            tipo_tarea_id=r.tipo_tarea_id,
            tipo_tarea_codigo=r.tipo_tarea.codigo,
            tipo_tarea_nombre=r.tipo_tarea.nombre,
            tipo_tarea_abreviatura=r.tipo_tarea.abreviatura,
            tipo_tarea_color=r.tipo_tarea.color_hex,
            observacion=r.observacion,
            firmada_at=r.firmada_at,
            puede_firmar=_puede_firmar(r.fecha, r.firmada_at),
        )
        for r in limpieza_rows
    ]

    periodo = get_periodo(db, anio, mes)
    estado_periodo = periodo.estado.value if periodo else "BORRADOR"
    es_empleado_puro = (
        "EMPLEADO" in {ur.rol.value for ur in usuario.roles}
        and "EDITOR" not in {ur.rol.value for ur in usuario.roles}
        and "SUPERADMIN" not in {ur.rol.value for ur in usuario.roles}
    )
    puede_ver = (not es_empleado_puro) or estado_periodo == "PUBLICADO"

    return DashboardEmpleadoOut(
        puede_ver=puede_ver,
        estado_periodo=estado_periodo,
        empleado=EmpleadoInfoOut(
            id=empleado.id,
            nombre=empleado.nombre,
            apellido=empleado.apellido,
            fecha_ingreso=empleado.fecha_ingreso,
            horas_semana_max=empleado.horas_semana_max,
        ),
        anio=anio,
        mes=mes,
        stats=stats,
        francos=francos,
        feriados_trabajados=feriados_trabajados,
        turnos=turnos_out,
        limpieza=limpieza_out,
    )
