"""Servicio de grilla: arma la matriz empleados x dias con turnos,
mas el calculo de cobertura y alertas del mes."""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.db.models.jornada import Turno
from app.db.models.limpieza import AsignacionLimpieza
from app.db.models.personas import Empleado
from app.schemas.calendario import EventoDiaOut
from app.schemas.grilla import (
    AsignacionLimpiezaGrillaOut,
    AlertaDiaOut,
    CoberturaDiaOut,
    DiaGrillaOut,
    EmpleadoGrillaOut,
    EstadoDiaOut,
    GrillaMesOut,
    TurnoGrillaOut,
)
from app.services.calendario import (
    eventos_activos_en,
    eventos_del_mes,
    resolver_tipo_dia_operativo,
)
from app.services.cobertura import (
    EstadoCobertura,
    armar_alerta,
    calcular_turnos_por_franja,
    cargar_franjas_por_contexto,
    contexto_del_dia,
    evaluar_estado,
)
from app.services.fechas import dias_del_mes, nombre_dia, rango_mes
from app.services.publicacion import get_periodo as get_periodo_grilla


def _color_por_prioridad(tipo_dia, eventos) -> str | None:
    if not eventos:
        return None
    orden = sorted(
        eventos,
        key=lambda e: (
            0 if e.genera_extra_100 else 1,
            0 if e.afecta_colegio else 1,
        ),
    )
    return orden[0].color_hex


def construir_grilla(db: Session, anio: int, mes: int) -> GrillaMesOut:
    primero, ultimo = rango_mes(anio, mes)

    # 1. Dias del mes con su tipo de dia operativo
    eventos = eventos_del_mes(db, anio, mes)
    dias_out: list[DiaGrillaOut] = []
    dias_meta: list[dict] = []  # auxiliar con fecha, tipo_dia, es_feriado
    for f in dias_del_mes(anio, mes):
        activos = eventos_activos_en(f, eventos)
        tipo = resolver_tipo_dia_operativo(f, activos)
        es_feriado = any(e.genera_extra_100 for e in activos)
        dias_out.append(
            DiaGrillaOut(
                fecha=f,
                dia_semana=f.weekday(),
                nombre_dia=nombre_dia(f),
                tipo_dia_operativo=tipo,
                es_fin_de_semana=f.weekday() >= 5,
                es_feriado=es_feriado,
                cierra_colegio=any(e.afecta_colegio for e in activos),
                color_hex=_color_por_prioridad(tipo, activos),
                eventos=[
                    EventoDiaOut(
                        id=e.id,
                        codigo=e.codigo,
                        nombre=e.nombre,
                        color_hex=e.color_hex,
                        genera_extra_100=e.genera_extra_100,
                    )
                    for e in activos
                ],
            )
        )
        dias_meta.append(
            {"fecha": f, "tipo_dia": tipo, "es_feriado": es_feriado}
        )

    # 2. Empleados activos
    empleados = (
        db.query(Empleado)
        .filter(Empleado.activo.is_(True))
        .order_by(Empleado.apellido, Empleado.nombre)
        .all()
    )
    empleados_out = [
        EmpleadoGrillaOut(
            id=e.id,
            nombre=e.nombre,
            apellido=e.apellido,
            activo=e.activo,
            horas_semana_max=e.horas_semana_max,
        )
        for e in empleados
    ]

    # 3. Turnos del mes con franja cargada
    turnos = (
        db.query(Turno)
        .options(joinedload(Turno.franja))
        .filter(Turno.fecha >= primero)
        .filter(Turno.fecha <= ultimo)
        .all()
    )
    turnos_out: list[TurnoGrillaOut] = []
    for t in turnos:
        fr = t.franja
        turnos_out.append(
            TurnoGrillaOut(
                id=t.id,
                empleado_id=t.empleado_id,
                fecha=t.fecha,
                franja_id=t.franja_id,
                franja_nombre=fr.nombre if fr else None,
                codigo_corto=fr.codigo_corto if fr else None,
                hora_inicio=fr.hora_inicio.strftime("%H:%M") if fr else None,
                hora_fin=fr.hora_fin.strftime("%H:%M") if fr else None,
                estado=t.estado,
                horas=float(t.horas),
                horas_extra=float(t.horas_extra),
                es_franco_protegido=t.es_franco_protegido,
                nota=t.nota,
            )
        )

    # 4. Cobertura y alertas
    franjas_por_contexto = cargar_franjas_por_contexto(db)
    turnos_por_franja = calcular_turnos_por_franja(db, anio, mes)

    cobertura_out: list[CoberturaDiaOut] = []
    alertas_out: list[AlertaDiaOut] = []
    estado_dia: dict[date, dict] = {}

    for meta in dias_meta:
        f = meta["fecha"]
        ctx = contexto_del_dia(f, meta["tipo_dia"], meta["es_feriado"])
        franjas_ctx = franjas_por_contexto.get(ctx, [])

        peor_estado = EstadoCobertura.CUBIERTO_OK
        alertas_dia = 0

        for fap in franjas_ctx:
            actual = turnos_por_franja.get((f, fap.franja_id), 0)
            estado = evaluar_estado(actual, fap.cantidad_minima, fap.cantidad_ideal)

            cob = CoberturaDiaOut(
                fecha=f,
                franja_id=fap.franja_id,
                franja_nombre=fap.franja_nombre,
                codigo_corto=fap.codigo_corto,
                contexto=ctx,
                actual=actual,
                minima=fap.cantidad_minima,
                ideal=fap.cantidad_ideal,
                estado=estado,
            )
            cobertura_out.append(cob)

            # Acumular el peor estado del dia
            if estado == EstadoCobertura.HUECO:
                peor_estado = EstadoCobertura.HUECO
            elif (
                estado == EstadoCobertura.CUBIERTO_JUSTO
                and peor_estado != EstadoCobertura.HUECO
            ):
                peor_estado = EstadoCobertura.CUBIERTO_JUSTO

            # Generar alerta si aplica
            alerta_dm = armar_alerta(cob)
            if alerta_dm is not None:
                alertas_out.append(
                    AlertaDiaOut(
                        fecha=alerta_dm.fecha,
                        franja_id=alerta_dm.franja_id,
                        franja_nombre=alerta_dm.franja_nombre,
                        nivel=alerta_dm.nivel,
                        mensaje=alerta_dm.mensaje,
                    )
                )
                alertas_dia += 1

        estado_dia[f] = {"estado": peor_estado, "alertas": alertas_dia}

    # 5. Mapear el estado agregado por dia al vocabulario visual
    def _a_visual(estado_cob: str) -> str:
        if estado_cob == EstadoCobertura.CUBIERTO_OK:
            return "OK"
        if estado_cob == EstadoCobertura.CUBIERTO_JUSTO:
            return "AMARILLO"
        return "ROJO"

    estado_por_dia_out = [
        EstadoDiaOut(
            fecha=f,
            estado=_a_visual(estado_dia[f]["estado"]),
            alertas=estado_dia[f]["alertas"],
        )
        for f in [m["fecha"] for m in dias_meta]
    ]

    # Asignaciones de limpieza del mes
    limpieza_rows = (
        db.query(AsignacionLimpieza)
        .options(joinedload(AsignacionLimpieza.tipo_tarea))
        .filter(AsignacionLimpieza.fecha >= primero)
        .filter(AsignacionLimpieza.fecha <= ultimo)
        .all()
    )
    limpieza_out = [
        AsignacionLimpiezaGrillaOut(
            id=r.id,
            empleado_id=r.empleado_id,
            fecha=r.fecha,
            tipo_tarea_id=r.tipo_tarea_id,
            tipo_tarea_codigo=r.tipo_tarea.codigo,
            tipo_tarea_nombre=r.tipo_tarea.nombre,
            tipo_tarea_color=r.tipo_tarea.color_hex,
        )
        for r in limpieza_rows
    ]

    periodo = get_periodo_grilla(db, anio, mes)
    estado_periodo = periodo.estado.value if periodo else "BORRADOR"

    return GrillaMesOut(
        anio=anio,
        mes=mes,
        estado_periodo=estado_periodo,
        dias=dias_out,
        empleados=empleados_out,
        turnos=turnos_out,
        cobertura=cobertura_out,
        alertas=alertas_out,
        estado_por_dia=estado_por_dia_out,
        limpieza=limpieza_out,
    )
