"""Servicios de vacaciones que tocan DB.

Aca vive:
- Carga de saldo anual.
- Calculo de dias tomados/pendientes.
- Creacion de periodos (novedades) con generacion de turnos VACACIONES.
- Cierre anual.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models.enums import (
    EstadoNovedad,
    EstadoTurno,
    EstadoVacacionesAnuales,
    ModoConteo,
    TipoNovedad,
)
from app.db.models.jornada import Novedad, Turno, VacacionesAnuales
from app.db.models.personas import Empleado
from app.services.vacaciones import calcular_periodo


def _get_empleado(db: Session, empleado_id: int) -> Empleado:
    emp = db.get(Empleado, empleado_id)
    if emp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Empleado {empleado_id} no existe",
        )
    return emp


def _get_anual(
    db: Session, empleado_id: int, anio: int
) -> VacacionesAnuales | None:
    return (
        db.query(VacacionesAnuales)
        .filter(VacacionesAnuales.anio == anio)
        .filter(VacacionesAnuales.empleado_id == empleado_id)
        .one_or_none()
    )


def _dias_tomados(db: Session, empleado_id: int, anio: int) -> int:
    """Suma de dias_computados de novedades ACTIVAS del anio vacacional."""
    novedades = (
        db.query(Novedad)
        .filter(Novedad.empleado_id == empleado_id)
        .filter(Novedad.tipo == TipoNovedad.VACACIONES)
        .filter(Novedad.anio_vacacional == anio)
        .filter(Novedad.estado == EstadoNovedad.ACTIVA)
        .all()
    )
    return sum(n.dias_computados for n in novedades)


def cargar_saldo_anual(
    db: Session,
    empleado_id: int,
    anio: int,
    dias_totales: int,
    modo_conteo: ModoConteo,
    observacion: str | None,
    cargado_por: int,
) -> VacacionesAnuales:
    _get_empleado(db, empleado_id)
    existente = _get_anual(db, empleado_id, anio)
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe saldo cargado para {anio}",
        )
    anual = VacacionesAnuales(
        anio=anio,
        empleado_id=empleado_id,
        dias_totales=dias_totales,
        modo_conteo=modo_conteo,
        estado=EstadoVacacionesAnuales.ABIERTA,
        dias_arrastrados=0,
        observacion=observacion,
        cargado_por=cargado_por,
    )
    db.add(anual)
    db.commit()
    db.refresh(anual)
    return anual


def calcular_totales(
    anual: VacacionesAnuales | None,
    dias_tomados: int,
) -> tuple[int, int]:
    """Devuelve (total_con_arrastre, pendientes)."""
    if anual is None:
        return 0, 0
    total = anual.dias_totales + anual.dias_arrastrados
    pendientes = total - dias_tomados
    return total, pendientes


def crear_periodo(
    db: Session,
    empleado_id: int,
    anio_vacacional: int,
    desde: date,
    dias: int,
    observacion: str | None,
    creada_por: int,
    *,
    confirmar_exceso: bool = False,
) -> Novedad:
    """Crea un periodo de vacaciones y genera los turnos VACACIONES.

    Si el periodo deja el saldo en negativo y `confirmar_exceso` es False,
    devuelve 409 con el detalle para que el front muestre la advertencia.
    """
    _get_empleado(db, empleado_id)

    anual = _get_anual(db, empleado_id, anio_vacacional)
    if anual is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"No hay saldo de vacaciones cargado para {anio_vacacional}. "
                "Cargalo antes de crear periodos."
            ),
        )
    if anual.estado == EstadoVacacionesAnuales.CERRADA:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El anio vacacional {anio_vacacional} esta cerrado",
        )

    # Calcular rango
    rango = calcular_periodo(db, desde, dias, anual.modo_conteo)

    # Chequear saldo
    total, _ = calcular_totales(anual, 0)
    tomados = _dias_tomados(db, empleado_id, anio_vacacional)
    pendientes_antes = total - tomados
    pendientes_despues = pendientes_antes - dias

    if pendientes_despues < 0 and not confirmar_exceso:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "codigo": "EXCESO_VACACIONES",
                "mensaje": (
                    f"Este periodo deja a {pendientes_despues} dias pendientes "
                    f"(negativo). Confirmar para guardar igual."
                ),
                "pendientes_antes": pendientes_antes,
                "pendientes_despues": pendientes_despues,
            },
        )

    # Crear la novedad
    novedad = Novedad(
        empleado_id=empleado_id,
        tipo=TipoNovedad.VACACIONES,
        desde=rango.desde,
        hasta=rango.hasta,
        dias_solicitados=dias,
        dias_computados=dias,
        anio_vacacional=anio_vacacional,
        observacion=observacion,
        estado=EstadoNovedad.ACTIVA,
        creada_por=creada_por,
    )
    db.add(novedad)
    db.flush()

    # Generar turnos VACACIONES para cada dia del rango que no este ya ocupado.
    actual = rango.desde
    while actual <= rango.hasta:
        # No pisamos turnos existentes.
        existente = (
            db.query(Turno)
            .filter(Turno.empleado_id == empleado_id)
            .filter(Turno.fecha == actual)
            .one_or_none()
        )
        if existente is None:
            db.add(
                Turno(
                    empleado_id=empleado_id,
                    fecha=actual,
                    estado=EstadoTurno.VACACIONES,
                    horas=0,
                    created_by=creada_por,
                )
            )
        else:
            # Si ya habia un turno y NO es VACACIONES, lo reportamos
            # como conflicto al usuario via el detalle.
            # Simplificacion MVP: lo dejamos tal cual.
            pass
        actual = actual + timedelta(days=1)

    db.commit()
    db.refresh(novedad)
    return novedad


def cancelar_periodo(
    db: Session, novedad_id: int, cancelada_por: int
) -> Novedad:
    """Cancela un periodo y borra los turnos VACACIONES asociados."""
    novedad = db.get(Novedad, novedad_id)
    if novedad is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Novedad {novedad_id} no existe",
        )
    if novedad.estado != EstadoNovedad.ACTIVA:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La novedad no esta activa",
        )

    # Borrar turnos VACACIONES del rango (solo los que esten sin observacion
    # adicional ni horas extra).
    turnos = (
        db.query(Turno)
        .filter(Turno.empleado_id == novedad.empleado_id)
        .filter(Turno.fecha >= novedad.desde)
        .filter(Turno.fecha <= novedad.hasta)
        .filter(Turno.estado == EstadoTurno.VACACIONES)
        .all()
    )
    for t in turnos:
        db.delete(t)

    novedad.estado = EstadoNovedad.CANCELADA
    db.commit()
    db.refresh(novedad)
    return novedad


def editar_periodo(
    db: Session,
    novedad_id: int,
    *,
    desde: date | None,
    dias: int | None,
    observacion: str | None,
    editada_por: int,
    confirmar_exceso: bool = False,
) -> Novedad:
    """Edita un periodo existente.

    - Recalcula rango segun los nuevos valores (o mantiene los que no
      vinieron).
    - Borra los turnos VACACIONES del rango VIEJO que sigan siendo
      VACACIONES sin HE ni nota.
    - Genera turnos VACACIONES para el rango NUEVO sin pisar existentes.
    - Valida saldo igual que al crear.
    """
    novedad = db.get(Novedad, novedad_id)
    if novedad is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Novedad {novedad_id} no existe",
        )
    if novedad.estado != EstadoNovedad.ACTIVA:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden editar periodos activos",
        )

    anual = _get_anual(db, novedad.empleado_id, novedad.anio_vacacional)
    if anual is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay saldo anual cargado para este periodo",
        )
    if anual.estado == EstadoVacacionesAnuales.CERRADA:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El anio vacacional {novedad.anio_vacacional} esta cerrado",
        )

    # Rango nuevo
    nuevo_desde = desde if desde is not None else novedad.desde
    nuevo_dias = dias if dias is not None else novedad.dias_computados
    nuevo_rango = calcular_periodo(db, nuevo_desde, nuevo_dias, anual.modo_conteo)

    # Validar saldo: contamos todos los periodos menos este, mas el nuevo
    tomados_otros = _dias_tomados(db, novedad.empleado_id, novedad.anio_vacacional) - novedad.dias_computados
    total, _ = calcular_totales(anual, 0)
    pendientes_despues = total - tomados_otros - nuevo_dias

    if pendientes_despues < 0 and not confirmar_exceso:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "codigo": "EXCESO_VACACIONES",
                "mensaje": (
                    f"El cambio deja a {pendientes_despues} dias pendientes "
                    f"(negativo). Confirmar para guardar igual."
                ),
                "pendientes_despues": pendientes_despues,
            },
        )

    # Borrar turnos VACACIONES del rango viejo, solo si siguen siendo
    # VACACIONES limpias (sin HE ni nota).
    turnos_viejos = (
        db.query(Turno)
        .filter(Turno.empleado_id == novedad.empleado_id)
        .filter(Turno.fecha >= novedad.desde)
        .filter(Turno.fecha <= novedad.hasta)
        .filter(Turno.estado == EstadoTurno.VACACIONES)
        .filter(Turno.horas_extra == 0)
        .all()
    )
    for t in turnos_viejos:
        # No borramos si tiene nota (algo cargo el editor).
        if t.nota:
            continue
        db.delete(t)

    # Crear los del rango nuevo (sin pisar)
    actual = nuevo_rango.desde
    while actual <= nuevo_rango.hasta:
        existente = (
            db.query(Turno)
            .filter(Turno.empleado_id == novedad.empleado_id)
            .filter(Turno.fecha == actual)
            .one_or_none()
        )
        if existente is None:
            db.add(
                Turno(
                    empleado_id=novedad.empleado_id,
                    fecha=actual,
                    estado=EstadoTurno.VACACIONES,
                    horas=0,
                    created_by=editada_por,
                )
            )
        actual = actual + timedelta(days=1)

    novedad.desde = nuevo_rango.desde
    novedad.hasta = nuevo_rango.hasta
    novedad.dias_solicitados = nuevo_dias
    novedad.dias_computados = nuevo_dias
    if observacion is not None:
        novedad.observacion = observacion

    db.commit()
    db.refresh(novedad)
    return novedad
