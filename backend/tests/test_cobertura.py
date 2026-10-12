"""Tests del calculo de cobertura. Puros, sin DB. ASCII puro."""

from __future__ import annotations

from datetime import date

from app.db.models.enums import ContextoFranja, TipoDiaOperativo
from app.services.cobertura import (
    EstadoCobertura,
    CoberturaDia,
    armar_alerta,
    contexto_del_dia,
    evaluar_estado,
)


class TestEvaluarEstado:
    def test_ok_por_encima_del_ideal(self) -> None:
        assert evaluar_estado(5, 2, 3) == EstadoCobertura.CUBIERTO_OK

    def test_ok_igual_al_ideal(self) -> None:
        assert evaluar_estado(3, 2, 3) == EstadoCobertura.CUBIERTO_OK

    def test_justo_igual_a_la_minima(self) -> None:
        assert evaluar_estado(2, 2, 3) == EstadoCobertura.CUBIERTO_JUSTO

    def test_justo_entre_minima_e_ideal(self) -> None:
        assert evaluar_estado(2, 1, 3) == EstadoCobertura.CUBIERTO_JUSTO

    def test_hueco_por_debajo_de_la_minima(self) -> None:
        assert evaluar_estado(1, 2, 3) == EstadoCobertura.HUECO

    def test_hueco_cero(self) -> None:
        assert evaluar_estado(0, 2, 3) == EstadoCobertura.HUECO

    def test_hueco_si_minima_es_1_y_actual_0(self) -> None:
        assert evaluar_estado(0, 1, 2) == EstadoCobertura.HUECO


class TestContextoDia:
    def test_lunes_normal_es_laboral(self) -> None:
        f = date(2026, 10, 5)  # lunes
        ctx = contexto_del_dia(f, TipoDiaOperativo.DIA_LABORAL_CON_COLEGIO, False)
        assert ctx == ContextoFranja.LABORAL

    def test_lunes_feriado_es_feriado(self) -> None:
        f = date(2026, 10, 12)  # lunes feriado
        ctx = contexto_del_dia(f, TipoDiaOperativo.FINDE_FERIADO, True)
        assert ctx == ContextoFranja.FERIADO

    def test_sabado_normal_es_finde(self) -> None:
        f = date(2026, 10, 10)  # sabado
        ctx = contexto_del_dia(f, TipoDiaOperativo.FINDE_FERIADO, False)
        assert ctx == ContextoFranja.FINDE

    def test_domingo_feriado_es_feriado(self) -> None:
        f = date(2026, 10, 11)  # domingo
        ctx = contexto_del_dia(f, TipoDiaOperativo.FINDE_FERIADO, True)
        assert ctx == ContextoFranja.FERIADO


class TestAlerta:
    def _cob(self, estado: str) -> CoberturaDia:
        return CoberturaDia(
            fecha=date(2026, 10, 10),
            franja_id=1,
            franja_nombre="LU_VIE_MANANA_7_15",
            codigo_corto="M",
            actual=1,
            minima=2,
            ideal=3,
            estado=estado,
        )

    def test_ok_no_genera_alerta(self) -> None:
        assert armar_alerta(self._cob(EstadoCobertura.CUBIERTO_OK)) is None

    def test_justo_genera_amarillo(self) -> None:
        a = armar_alerta(self._cob(EstadoCobertura.CUBIERTO_JUSTO))
        assert a is not None
        assert a.nivel == "AMARILLO"

    def test_hueco_genera_rojo(self) -> None:
        a = armar_alerta(self._cob(EstadoCobertura.HUECO))
        assert a is not None
        assert a.nivel == "ROJO"
