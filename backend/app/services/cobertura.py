"""Calculo de cobertura por dia y franja.

Para cada fecha del mes, se evaluan las franjas que aplican al contexto
del dia (LABORAL / FINDE / FERIADO). Se cuentan los turnos con estado
TRABAJO y esa franja asignada, y se compara contra las reglas.

Estados:
- CUBIERTO_OK    (verde):  actual >= ideal.
- CUBIERTO_JUSTO (amarillo): minima <= actual < ideal.
- HUECO          (rojo):   actual < minima.

Este modulo es puro en su nucleo: la funcion `evaluar_cobertura` recibe
los contadores y las reglas, sin tocar la DB.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from app.db.models.enums import ContextoFranja, EstadoTurno, TipoDiaOperativo
from app.db.models.jornada import Turno
from app.db.models.operativa import Franja, ReglaCobertura


class EstadoCobertura:
    CUBIERTO_OK = "CUBIERTO_OK"
    CUBIERTO_JUSTO = "CUBIERTO_JUSTO"
    HUECO = "HUECO"


@dataclass(frozen=True)
class FranjaAplicable:
    """Franja que aplica a un contexto dado, con su regla."""

    franja_id: int
    franja_nombre: str
    codigo_corto: str | None
    contexto: ContextoFranja
    cantidad_minima: int
    cantidad_ideal: int
    orden: int


@dataclass(frozen=True)
class CoberturaDia:
    """Resultado de cobertura para un dia/franja."""

    fecha: date
    franja_id: int
    franja_nombre: str
    codigo_corto: str | None
    actual: int
    minima: int
    ideal: int
    estado: str


@dataclass(frozen=True)
class AlertaDia:
    """Alerta calculada. No se persiste, se recalcula cada vez."""

    fecha: date
    franja_id: int
    franja_nombre: str
    nivel: str  # AMARILLO | ROJO
    mensaje: str


# ----------------------------------------------------------------------
# Nucleo puro
# ----------------------------------------------------------------------
def evaluar_estado(actual: int, minima: int, ideal: int) -> str:
    """Aplica las 3 reglas del semaforo. Sin DB."""
    if actual >= ideal:
        return EstadoCobertura.CUBIERTO_OK
    if actual >= minima:
        return EstadoCobertura.CUBIERTO_JUSTO
    return EstadoCobertura.HUECO


def contexto_del_dia(
    fecha: date, tipo_dia: TipoDiaOperativo, es_feriado: bool
) -> ContextoFranja:
    """Deriva el contexto de franja a partir del tipo de dia.

    Prioridad: feriado > finde > laboral.
    """
    if es_feriado:
        return ContextoFranja.FERIADO
    if tipo_dia == TipoDiaOperativo.FINDE_FERIADO:
        return ContextoFranja.FINDE
    return ContextoFranja.LABORAL


def armar_alerta(cob) -> AlertaDia | None:
    """Devuelve la alerta correspondiente al estado, o None si esta OK."""
    if cob.estado == EstadoCobertura.CUBIERTO_OK:
        return None

    if cob.estado == EstadoCobertura.HUECO:
        nivel = "ROJO"
        etiqueta = "Sin cobertura"
    else:
        nivel = "AMARILLO"
        etiqueta = "Cobertura justa"

    mensaje = (
        f"{etiqueta}: {cob.franja_nombre} tiene {cob.actual} "
        f"(min {cob.minima}, ideal {cob.ideal})"
    )
    return AlertaDia(
        fecha=cob.fecha,
        franja_id=cob.franja_id,
        franja_nombre=cob.franja_nombre,
        nivel=nivel,
        mensaje=mensaje,
    )


# ----------------------------------------------------------------------
# Carga desde DB
# ----------------------------------------------------------------------
def cargar_franjas_por_contexto(db: Session) -> dict[ContextoFranja, list[FranjaAplicable]]:
    """Carga las franjas activas y las reglas de cobertura, agrupadas
    por contexto.

    Como las franjas y las reglas estan separadas, hacemos el join manual
    en Python. Filtramos las reglas por (franja, tipo_dia) pero como el
    contexto ya agrupa eso, para LABORAL usamos la regla de
    DIA_LABORAL_CON_COLEGIO (o SIN_COLEGIO si no hay CON_COLEGIO).
    """
    franjas = db.query(Franja).filter(Franja.activa.is_(True)).all()
    franjas_por_id: dict[int, Franja] = {f.id: f for f in franjas}

    reglas = db.query(ReglaCobertura).filter(ReglaCobertura.activo.is_(True)).all()

    # Mapa (franja_id, tipo_dia) -> regla
    regla_map: dict[tuple[int, TipoDiaOperativo], ReglaCobertura] = {
        (r.franja_id, r.tipo_dia_operativo): r for r in reglas
    }

    # Mapear contexto -> tipo_dia preferido para buscar regla
    # (LABORAL usa CON_COLEGIO como canonico; SIN_COLEGIO tiene sus propios numeros
    # pero para el semaforo visual usamos el mismo).
    resultado: dict[ContextoFranja, list[FranjaAplicable]] = {
        ContextoFranja.LABORAL: [],
        ContextoFranja.FINDE: [],
        ContextoFranja.FERIADO: [],
    }

    for f in franjas:
        if f.contexto is None:
            continue

        tipo_dia: TipoDiaOperativo | None = None
        if f.contexto == ContextoFranja.LABORAL:
            tipo_dia = TipoDiaOperativo.DIA_LABORAL_CON_COLEGIO
        elif f.contexto == ContextoFranja.FINDE:
            tipo_dia = TipoDiaOperativo.FINDE_FERIADO
        elif f.contexto == ContextoFranja.FERIADO:
            tipo_dia = TipoDiaOperativo.FINDE_FERIADO

        if tipo_dia is None:
            continue

        r = regla_map.get((f.id, tipo_dia))
        if r is None:
            # Sin regla definida: cobertura minima 0, ideal 0
            minima, ideal = 0, 0
        else:
            minima, ideal = r.cantidad_minima, r.cantidad_ideal

        resultado[f.contexto].append(
            FranjaAplicable(
                franja_id=f.id,
                franja_nombre=f.nombre,
                codigo_corto=f.codigo_corto,
                contexto=f.contexto,
                cantidad_minima=minima,
                cantidad_ideal=ideal,
                orden=f.orden,
            )
        )

    # Ordenar por orden dentro de cada contexto
    for ctx in resultado:
        resultado[ctx].sort(key=lambda x: x.orden)

    return resultado


def calcular_turnos_por_franja(
    db: Session, anio: int, mes: int
) -> dict[tuple[date, int], int]:
    """Cuenta turnos TRABAJO por (fecha, franja_id) en el mes.

    Solo cuenta turnos con estado TRABAJO y franja asignada.
    """
    from app.services.fechas import rango_mes

    primero, ultimo = rango_mes(anio, mes)

    turnos = (
        db.query(Turno.fecha, Turno.franja_id)
        .filter(Turno.fecha >= primero)
        .filter(Turno.fecha <= ultimo)
        .filter(Turno.estado == EstadoTurno.TRABAJO)
        .filter(Turno.franja_id.isnot(None))
        .all()
    )

    conteo: dict[tuple[date, int], int] = {}
    for fecha, franja_id in turnos:
        if franja_id is None:
            continue
        clave = (fecha, franja_id)
        conteo[clave] = conteo.get(clave, 0) + 1
    return conteo
