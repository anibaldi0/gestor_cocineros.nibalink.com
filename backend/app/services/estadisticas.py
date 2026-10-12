"""Estadisticas mensuales para editor y superadmin.

Devuelve, por empleado activo, los contadores del mes: horas, francos,
vacaciones, licencias, ausencias, HE. Mas agregados institucionales.

No calcula alertas proactivas (dias seguidos, saldo de horas, etc.):
eso va en otro modulo.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models.enums import EstadoTurno
from app.db.models.jornada import Turno
from app.db.models.personas import Empleado
from app.schemas.estadisticas import (
    StatsAgregadasMesOut,
    StatsEmpleadoMesOut,
    StatsMesOut,
)
from app.services.cobertura import (
    EstadoCobertura,
    calcular_turnos_por_franja,
    cargar_franjas_por_contexto,
    contexto_del_dia,
    evaluar_estado,
)
from app.services.calendario import (
    eventos_activos_en,
    eventos_del_mes,
    resolver_tipo_dia_operativo,
)
from app.services.fechas import dias_del_mes, rango_mes


def _es_licencia(estado: EstadoTurno) -> bool:
    return estado in (
        EstadoTurno.LICENCIA_MEDICA,
        EstadoTurno.ART,
        EstadoTurno.LICENCIA_ESPECIAL,
    )


def construir_estadisticas_mes(
    db: Session, anio: int, mes: int
) -> StatsMesOut:
    primero, ultimo = rango_mes(anio, mes)

    # Empleados activos
    empleados = (
        db.query(Empleado)
        .filter(Empleado.activo.is_(True))
        .order_by(Empleado.apellido, Empleado.nombre)
        .all()
    )

    # Turnos del mes
    turnos = (
        db.query(Turno)
        .filter(Turno.fecha >= primero)
        .filter(Turno.fecha <= ultimo)
        .all()
    )

    # Agrupar por empleado
    por_empleado: dict[int, list[Turno]] = {}
    for t in turnos:
        por_empleado.setdefault(t.empleado_id, []).append(t)

    filas: list[StatsEmpleadoMesOut] = []
    horas_plantel = 0.0
    he_plantel = 0.0

    for emp in empleados:
        turnos_emp = por_empleado.get(emp.id, [])
        dias_trab = 0
        dias_franco = 0
        dias_vac = 0
        dias_lic = 0
        dias_aus = 0
        horas_trab = 0.0
        horas_he = 0.0
        dias_con_he = 0

        for t in turnos_emp:
            h = float(t.horas or 0)
            he = float(t.horas_extra or 0)
            if t.estado == EstadoTurno.TRABAJO:
                dias_trab += 1
                horas_trab += h
            elif t.estado == EstadoTurno.FRANCO:
                dias_franco += 1
            elif t.estado == EstadoTurno.VACACIONES:
                dias_vac += 1
            elif _es_licencia(t.estado):
                dias_lic += 1
            elif t.estado == EstadoTurno.AUSENCIA_INJUSTIFICADA:
                dias_aus += 1

            if he > 0:
                horas_he += he
                dias_con_he += 1

        horas_plantel += horas_trab
        he_plantel += horas_he

        filas.append(
            StatsEmpleadoMesOut(
                empleado_id=emp.id,
                nombre=emp.nombre,
                apellido=emp.apellido,
                dni=emp.dni,
                horas_semana_max=emp.horas_semana_max,
                dias_trabajados=dias_trab,
                dias_franco=dias_franco,
                dias_vacaciones=dias_vac,
                dias_licencia=dias_lic,
                dias_ausencia=dias_aus,
                horas_trabajadas=round(horas_trab, 2),
                horas_extra=round(horas_he, 2),
                horas_totales=round(horas_trab + horas_he, 2),
                dias_con_he=dias_con_he,
            )
        )

    # Agregados institucionales: cobertura por dia
    franjas_por_contexto = cargar_franjas_por_contexto(db)
    turnos_por_franja = calcular_turnos_por_franja(db, anio, mes)
    eventos = eventos_del_mes(db, anio, mes)

    dias_rojos = 0
    dias_amarillos = 0
    for f in dias_del_mes(anio, mes):
        activos = eventos_activos_en(f, eventos)
        tipo = resolver_tipo_dia_operativo(f, activos)
        es_feriado = any(e.genera_extra_100 for e in activos)
        ctx = contexto_del_dia(f, tipo, es_feriado)
        franjas = franjas_por_contexto.get(ctx, [])

        peor = EstadoCobertura.CUBIERTO_OK
        for fap in franjas:
            cnt = turnos_por_franja.get((f, fap.franja_id), 0)
            estado = evaluar_estado(cnt, fap.cantidad_minima, fap.cantidad_ideal)
            if estado == EstadoCobertura.HUECO:
                peor = EstadoCobertura.HUECO
                break
            if estado == EstadoCobertura.CUBIERTO_JUSTO:
                peor = EstadoCobertura.CUBIERTO_JUSTO

        if peor == EstadoCobertura.HUECO:
            dias_rojos += 1
        elif peor == EstadoCobertura.CUBIERTO_JUSTO:
            dias_amarillos += 1

    agregadas = StatsAgregadasMesOut(
        dias_totales_mes=len(dias_del_mes(anio, mes)),
        dias_con_alerta_roja=dias_rojos,
        dias_con_alerta_amarilla=dias_amarillos,
        empleados_activos=len(empleados),
        horas_totales_plantel=round(horas_plantel, 2),
        horas_extra_totales=round(he_plantel, 2),
    )

    return StatsMesOut(
        anio=anio, mes=mes, empleados=filas, agregadas=agregadas
    )


# ----------------------------------------------------------------------
# Agregados anuales
# ----------------------------------------------------------------------
def _sumar_agregadas(items: list[StatsAgregadasMesOut]) -> StatsAgregadasMesOut:
    return StatsAgregadasMesOut(
        dias_totales_mes=sum(i.dias_totales_mes for i in items),
        dias_con_alerta_roja=sum(i.dias_con_alerta_roja for i in items),
        dias_con_alerta_amarilla=sum(
            i.dias_con_alerta_amarilla for i in items
        ),
        empleados_activos=max((i.empleados_activos for i in items), default=0),
        horas_totales_plantel=round(
            sum(i.horas_totales_plantel for i in items), 2
        ),
        horas_extra_totales=round(
            sum(i.horas_extra_totales for i in items), 2
        ),
    )


def _sumar_empleados(
    items: list[StatsEmpleadoMesOut],
) -> StatsEmpleadoMesOut:
    base = items[0]
    return StatsEmpleadoMesOut(
        empleado_id=base.empleado_id,
        nombre=base.nombre,
        apellido=base.apellido,
        dni=base.dni,
        horas_semana_max=base.horas_semana_max,
        dias_trabajados=sum(i.dias_trabajados for i in items),
        dias_franco=sum(i.dias_franco for i in items),
        dias_vacaciones=sum(i.dias_vacaciones for i in items),
        dias_licencia=sum(i.dias_licencia for i in items),
        dias_ausencia=sum(i.dias_ausencia for i in items),
        horas_trabajadas=round(sum(i.horas_trabajadas for i in items), 2),
        horas_extra=round(sum(i.horas_extra for i in items), 2),
        horas_totales=round(sum(i.horas_totales for i in items), 2),
        dias_con_he=sum(i.dias_con_he for i in items),
    )


def construir_estadisticas_anio(db: Session, anio: int) -> "StatsAnioOut":
    """Suma los 12 meses del anio. Reutiliza el constructor mensual."""
    from app.schemas.estadisticas import (
        StatsAnioOut,
        StatsMesResumenOut,
    )

    por_mes: list[StatsMesResumenOut] = []
    por_empleado: dict[int, list[StatsEmpleadoMesOut]] = {}
    agregadas_por_mes: list[StatsAgregadasMesOut] = []
    empleado_orden: list[int] = []

    for m in range(1, 13):
        mes_stats = construir_estadisticas_mes(db, anio, m)
        por_mes.append(
            StatsMesResumenOut(mes=m, agregadas=mes_stats.agregadas)
        )
        agregadas_por_mes.append(mes_stats.agregadas)
        for e in mes_stats.empleados:
            if e.empleado_id not in por_empleado:
                por_empleado[e.empleado_id] = []
                empleado_orden.append(e.empleado_id)
            por_empleado[e.empleado_id].append(e)

    empleados_out = [
        _sumar_empleados(por_empleado[eid]) for eid in empleado_orden
    ]
    # Ordenar por apellido
    empleados_out.sort(key=lambda x: (x.apellido.lower(), x.nombre.lower()))

    return StatsAnioOut(
        anio=anio,
        empleados=empleados_out,
        agregadas=_sumar_agregadas(agregadas_por_mes),
        por_mes=por_mes,
    )


def construir_estadisticas_historico(db: Session) -> "StatsHistoricoOut":
    """Agregados por anio. Solo superadmin."""
    from app.schemas.estadisticas import (
        StatsAnioResumenOut,
        StatsHistoricoOut,
    )

    # Anios con turnos cargados
    anios_rows = (
        db.query(Turno.fecha)
        .distinct()
        .all()
    )
    anios = sorted({r[0].year for r in anios_rows}, reverse=True)

    resumenes: list[StatsAnioResumenOut] = []
    for a in anios:
        anio_stats = construir_estadisticas_anio(db, a)
        resumenes.append(
            StatsAnioResumenOut(anio=a, agregadas=anio_stats.agregadas)
        )

    total_empleados = (
        db.query(Empleado.id).distinct().count()
    )

    return StatsHistoricoOut(
        anios=resumenes,
        total_empleados_distintos=total_empleados,
    )
