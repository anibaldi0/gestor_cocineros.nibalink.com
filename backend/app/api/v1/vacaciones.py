"""Endpoints de vacaciones.

- GET    /api/v1/vacaciones/{anio}                       -> listado con saldo
- GET    /api/v1/vacaciones/{anio}/{empleado_id}         -> detalle con periodos
- POST   /api/v1/vacaciones/{anio}/{empleado_id}         -> cargar saldo anual
- PATCH  /api/v1/vacaciones/{anio}/{empleado_id}         -> editar saldo
- POST   /api/v1/vacaciones/novedades                    -> crear periodo
- DELETE /api/v1/vacaciones/novedades/{novedad_id}       -> cancelar periodo
- GET    /api/v1/vacaciones/impacto                      -> simulacion cobertura
- POST   /api/v1/vacaciones/{anio}/cerrar                -> cierre anual
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUserDep, DbDep, require_role
from app.db.models.enums import (
    EstadoNovedad,
    EstadoTurno,
    EstadoVacacionesAnuales,
    Rol,
    TipoNovedad,
)
from app.db.models.jornada import Novedad, Turno, VacacionesAnuales
from app.db.models.personas import Empleado
from app.schemas.vacaciones import (
    CierreAnioIn,
    CierreAnioOut,
    EmpleadoVacacionesOut,
    ImpactoCoberturaOut,
    ImpactoDiaOut,
    ListadoVacacionesOut,
    NovedadVacacionesCreate,
    NovedadVacacionesOut,
    NovedadVacacionesUpdate,
    VacacionesAnualesCreate,
    VacacionesAnualesOut,
    VacacionesAnualesUpdate,
)
from app.services.vacaciones_db import (
    calcular_totales,
    cancelar_periodo,
    cargar_saldo_anual,
    crear_periodo,
    editar_periodo,
)
from app.services.vacaciones import calcular_periodo
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
from app.services.fechas import dias_del_mes

router = APIRouter(prefix="/vacaciones", tags=["vacaciones"])


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def _dias_tomados(db: Session, empleado_id: int, anio: int) -> int:
    novedades = (
        db.query(Novedad)
        .filter(Novedad.empleado_id == empleado_id)
        .filter(Novedad.tipo == TipoNovedad.VACACIONES)
        .filter(Novedad.anio_vacacional == anio)
        .filter(Novedad.estado == EstadoNovedad.ACTIVA)
        .all()
    )
    return sum(n.dias_computados for n in novedades)


def _to_out(db: Session, anual: VacacionesAnuales) -> VacacionesAnualesOut:
    tomados = _dias_tomados(db, anual.empleado_id, anual.anio)
    total, pendientes = calcular_totales(anual, tomados)
    return VacacionesAnualesOut(
        anio=anual.anio,
        empleado_id=anual.empleado_id,
        dias_totales=anual.dias_totales,
        modo_conteo=anual.modo_conteo,
        estado=anual.estado,
        dias_arrastrados=anual.dias_arrastrados,
        observacion=anual.observacion,
        fecha_carga=anual.fecha_carga,
        dias_tomados=tomados,
        dias_pendientes=pendientes,
    )


# ----------------------------------------------------------------------
# Impacto en cobertura
# ----------------------------------------------------------------------
@router.get(
    "/impacto/simular",
    response_model=ImpactoCoberturaOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def simular_impacto(
    db: DbDep,
    _user: CurrentUserDep,
    desde: str = Query(...),
    hasta: str = Query(...),
    empleado_id: int = Query(...),
) -> ImpactoCoberturaOut:
    """Simula el impacto en cobertura si un empleado se toma vacaciones
    entre `desde` y `hasta`. Ignora al empleado en el conteo.
    """
    from app.core.fechas_parse import parse_fecha

    f_desde = parse_fecha(desde)
    f_hasta = parse_fecha(hasta)

    franjas_por_contexto = cargar_franjas_por_contexto(db)

    # Traer eventos del rango
    anios_meses = set()
    actual = f_desde
    from datetime import timedelta

    while actual <= f_hasta:
        anios_meses.add((actual.year, actual.month))
        actual = actual + timedelta(days=1)

    eventos_por_mes: dict[tuple[int, int], list] = {}
    for (a, m) in anios_meses:
        eventos_por_mes[(a, m)] = eventos_del_mes(db, a, m)

    # Traer los turnos del rango
    turnos = (
        db.query(Turno)
        .filter(Turno.fecha >= f_desde)
        .filter(Turno.fecha <= f_hasta)
        .filter(Turno.estado == EstadoTurno.TRABAJO)
        .filter(Turno.franja_id.isnot(None))
        .all()
    )
    # Contar por (fecha, franja_id) sin contar al empleado_id
    conteo: dict[tuple[date, int], int] = {}
    for t in turnos:
        if t.empleado_id == empleado_id:
            continue
        clave = (t.fecha, t.franja_id)
        conteo[clave] = conteo.get(clave, 0) + 1

    # Evaluar cada dia
    dias_out: list[ImpactoDiaOut] = []
    actual = f_desde
    while actual <= f_hasta:
        eventos = eventos_por_mes.get((actual.year, actual.month), [])
        activos = eventos_activos_en(actual, eventos)
        tipo = resolver_tipo_dia_operativo(actual, activos)
        es_feriado = any(e.genera_extra_100 for e in activos)
        ctx = contexto_del_dia(actual, tipo, es_feriado)
        franjas = franjas_por_contexto.get(ctx, [])

        peor = EstadoCobertura.CUBIERTO_OK
        alertas = 0
        mensaje = None
        for fap in franjas:
            cnt = conteo.get((actual, fap.franja_id), 0)
            estado = evaluar_estado(cnt, fap.cantidad_minima, fap.cantidad_ideal)
            if estado == EstadoCobertura.HUECO:
                peor = EstadoCobertura.HUECO
                alertas += 1
                if mensaje is None:
                    mensaje = (
                        f"Sin cobertura: {fap.franja_nombre} tiene "
                        f"{cnt} (min {fap.cantidad_minima})"
                    )
            elif (
                estado == EstadoCobertura.CUBIERTO_JUSTO
                and peor != EstadoCobertura.HUECO
            ):
                peor = EstadoCobertura.CUBIERTO_JUSTO
                alertas += 1
                if mensaje is None:
                    mensaje = (
                        f"Cobertura justa: {fap.franja_nombre} tiene "
                        f"{cnt} (ideal {fap.cantidad_ideal})"
                    )

        visual = {
            EstadoCobertura.CUBIERTO_OK: "OK",
            EstadoCobertura.CUBIERTO_JUSTO: "AMARILLO",
            EstadoCobertura.HUECO: "ROJO",
        }[peor]

        dias_out.append(
            ImpactoDiaOut(
                fecha=actual, estado=visual, alertas=alertas, mensaje=mensaje
            )
        )
        actual = actual + timedelta(days=1)

    return ImpactoCoberturaOut(desde=f_desde, hasta=f_hasta, dias=dias_out)


# ----------------------------------------------------------------------
# Listado del anio
# ----------------------------------------------------------------------
@router.get(
    "/{anio}",
    response_model=ListadoVacacionesOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def listado(db: DbDep, _user: CurrentUserDep, anio: int) -> ListadoVacacionesOut:
    """Lista todos los empleados activos con su saldo del anio."""
    empleados = (
        db.query(Empleado)
        .filter(Empleado.activo.is_(True))
        .order_by(Empleado.apellido, Empleado.nombre)
        .all()
    )
    anuales = {
        v.empleado_id: v
        for v in db.query(VacacionesAnuales)
        .filter(VacacionesAnuales.anio == anio)
        .all()
    }

    items: list[EmpleadoVacacionesOut] = []
    for e in empleados:
        anual = anuales.get(e.id)
        if anual is None:
            items.append(
                EmpleadoVacacionesOut(
                    empleado_id=e.id,
                    nombre=e.nombre,
                    apellido=e.apellido,
                    dni=e.dni,
                    anio=anio,
                    dias_totales=None,
                    modo_conteo=None,
                    estado=None,
                    dias_arrastrados=0,
                    dias_tomados=0,
                    dias_pendientes=None,
                )
            )
            continue
        tomados = _dias_tomados(db, e.id, anio)
        total, pendientes = calcular_totales(anual, tomados)
        items.append(
            EmpleadoVacacionesOut(
                empleado_id=e.id,
                nombre=e.nombre,
                apellido=e.apellido,
                dni=e.dni,
                anio=anio,
                dias_totales=anual.dias_totales,
                modo_conteo=anual.modo_conteo,
                estado=anual.estado,
                dias_arrastrados=anual.dias_arrastrados,
                dias_tomados=tomados,
                dias_pendientes=pendientes,
            )
        )

    return ListadoVacacionesOut(anio=anio, empleados=items)


# ----------------------------------------------------------------------
# Detalle de un empleado
# ----------------------------------------------------------------------
@router.get(
    "/{anio}/{empleado_id}",
    response_model=dict,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def detalle(
    db: DbDep, _user: CurrentUserDep, anio: int, empleado_id: int
) -> dict:
    emp = db.get(Empleado, empleado_id)
    if emp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Empleado {empleado_id} no existe",
        )
    anual = (
        db.query(VacacionesAnuales)
        .filter(VacacionesAnuales.anio == anio)
        .filter(VacacionesAnuales.empleado_id == empleado_id)
        .one_or_none()
    )

    novedades = (
        db.query(Novedad)
        .filter(Novedad.empleado_id == empleado_id)
        .filter(Novedad.tipo == TipoNovedad.VACACIONES)
        .filter(Novedad.anio_vacacional == anio)
        .order_by(Novedad.desde)
        .all()
    )

    anual_out = _to_out(db, anual) if anual else None

    return {
        "empleado": {
            "id": emp.id,
            "nombre": emp.nombre,
            "apellido": emp.apellido,
            "dni": emp.dni,
        },
        "anio": anio,
        "anual": anual_out.model_dump() if anual_out else None,
        "novedades": [
            {
                "id": n.id,
                "desde": n.desde.isoformat(),
                "hasta": n.hasta.isoformat(),
                "dias_solicitados": n.dias_solicitados,
                "dias_computados": n.dias_computados,
                "observacion": n.observacion,
                "estado": n.estado.value,
                "fecha_creacion": n.fecha_creacion.isoformat(),
            }
            for n in novedades
        ],
    }


# ----------------------------------------------------------------------
# Cargar saldo anual
# ----------------------------------------------------------------------
@router.post(
    "/{anio}/{empleado_id}",
    response_model=VacacionesAnualesOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def cargar_saldo(
    db: DbDep,
    user: CurrentUserDep,
    anio: int,
    empleado_id: int,
    payload: VacacionesAnualesCreate,
) -> VacacionesAnualesOut:
    anual = cargar_saldo_anual(
        db,
        empleado_id=empleado_id,
        anio=anio,
        dias_totales=payload.dias_totales,
        modo_conteo=payload.modo_conteo,
        observacion=payload.observacion,
        cargado_por=user.id,
    )
    return _to_out(db, anual)


@router.patch(
    "/{anio}/{empleado_id}",
    response_model=VacacionesAnualesOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def editar_saldo(
    db: DbDep,
    anio: int,
    empleado_id: int,
    payload: VacacionesAnualesUpdate,
) -> VacacionesAnualesOut:
    anual = (
        db.query(VacacionesAnuales)
        .filter(VacacionesAnuales.anio == anio)
        .filter(VacacionesAnuales.empleado_id == empleado_id)
        .one_or_none()
    )
    if anual is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No hay saldo cargado para {anio}",
        )
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(anual, k, v)
    db.commit()
    db.refresh(anual)
    return _to_out(db, anual)


# ----------------------------------------------------------------------
# Crear periodo
# ----------------------------------------------------------------------
@router.post(
    "/novedades",
    response_model=NovedadVacacionesOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def crear_novedad(
    db: DbDep,
    user: CurrentUserDep,
    payload: NovedadVacacionesCreate,
    confirmar_exceso: bool = Query(default=False),
) -> NovedadVacacionesOut:
    novedad = crear_periodo(
        db,
        empleado_id=payload.empleado_id,
        anio_vacacional=payload.anio_vacacional,
        desde=payload.desde,
        dias=payload.dias,
        observacion=payload.observacion,
        creada_por=user.id,
        confirmar_exceso=confirmar_exceso,
    )
    return NovedadVacacionesOut.model_validate(novedad)


@router.patch(
    "/novedades/{novedad_id}",
    response_model=NovedadVacacionesOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def editar_novedad(
    db: DbDep,
    user: CurrentUserDep,
    novedad_id: int,
    payload: NovedadVacacionesUpdate,
    confirmar_exceso: bool = Query(default=False),
) -> NovedadVacacionesOut:
    novedad = editar_periodo(
        db,
        novedad_id,
        desde=payload.desde,
        dias=payload.dias,
        observacion=payload.observacion,
        editada_por=user.id,
        confirmar_exceso=confirmar_exceso,
    )
    return NovedadVacacionesOut.model_validate(novedad)


@router.delete(
    "/novedades/{novedad_id}",
    response_model=NovedadVacacionesOut,
    dependencies=[require_role(Rol.EDITOR, Rol.SUPERADMIN)],
)
def eliminar_novedad(
    db: DbDep, user: CurrentUserDep, novedad_id: int
) -> NovedadVacacionesOut:
    novedad = cancelar_periodo(db, novedad_id, cancelada_por=user.id)
    return NovedadVacacionesOut.model_validate(novedad)


# ----------------------------------------------------------------------
# Cierre anual
# ----------------------------------------------------------------------
@router.post(
    "/{anio}/cerrar",
    response_model=CierreAnioOut,
    dependencies=[require_role(Rol.SUPERADMIN)],
)
def cerrar_anio(
    db: DbDep, user: CurrentUserDep, anio: int, payload: CierreAnioIn
) -> CierreAnioOut:
    """Cierra el anio vacacional. Por cada empleado, decide que hacer
    con los dias pendientes.

    - PERDER: pendientes se descartan.
    - ARRASTRAR: se suman al anio siguiente via dias_arrastrados.
    - COMPENSAR: se marca en observacion (el editor resuelve a mano).
    """
    procesados = 0
    detalle: list[str] = []

    for item in payload.items:
        anual = (
            db.query(VacacionesAnuales)
            .filter(VacacionesAnuales.anio == anio)
            .filter(VacacionesAnuales.empleado_id == item.empleado_id)
            .one_or_none()
        )
        if anual is None:
            detalle.append(
                f"Empleado {item.empleado_id}: sin saldo cargado, se saltea."
            )
            continue
        if anual.estado == EstadoVacacionesAnuales.CERRADA:
            detalle.append(
                f"Empleado {item.empleado_id}: anio ya cerrado, se saltea."
            )
            continue

        tomados = _dias_tomados(db, item.empleado_id, anio)
        _, pendientes = calcular_totales(anual, tomados)

        if item.decision == "PERDER":
            anual.observacion = (
                (anual.observacion or "")
                + f" | Cierre {anio}: se pierden {pendientes} dias pendientes."
            ).strip(" |")
        elif item.decision == "ARRASTRAR":
            if pendientes > 0:
                siguiente = (
                    db.query(VacacionesAnuales)
                    .filter(VacacionesAnuales.anio == anio + 1)
                    .filter(
                        VacacionesAnuales.empleado_id == item.empleado_id
                    )
                    .one_or_none()
                )
                if siguiente is None:
                    siguiente = VacacionesAnuales(
                        anio=anio + 1,
                        empleado_id=item.empleado_id,
                        dias_totales=0,
                        modo_conteo=anual.modo_conteo,
                        estado=EstadoVacacionesAnuales.ABIERTA,
                        dias_arrastrados=pendientes,
                        observacion="Abierto automaticamente por cierre anterior.",
                        cargado_por=user.id,
                    )
                    db.add(siguiente)
                else:
                    siguiente.dias_arrastrados += pendientes
                detalle.append(
                    f"Empleado {item.empleado_id}: {pendientes} dias "
                    f"arrastrados a {anio + 1}."
                )
            else:
                detalle.append(
                    f"Empleado {item.empleado_id}: sin pendientes positivos."
                )
        elif item.decision == "COMPENSAR":
            anual.observacion = (
                (anual.observacion or "")
                + f" | Cierre {anio}: {pendientes} dias a compensar a mano."
            ).strip(" |")
        else:
            detalle.append(
                f"Empleado {item.empleado_id}: decision desconocida "
                f"'{item.decision}', se saltea."
            )
            continue

        anual.estado = EstadoVacacionesAnuales.CERRADA
        anual.cerrado_por = user.id
        from datetime import datetime, timezone

        anual.fecha_cierre = datetime.now(tz=timezone.utc)
        procesados += 1

    db.commit()
    return CierreAnioOut(anio=anio, procesados=procesados, detalle=detalle)
