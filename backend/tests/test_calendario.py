"""Tests del calculo de tipo_dia_operativo. Puros, sin DB."""

from __future__ import annotations

from datetime import date

import pytest

from app.db.models.enums import TipoDiaOperativo
from app.services.calendario import EventoActivo, resolver_tipo_dia_operativo


def _ev(
    codigo: str,
    fuerza: TipoDiaOperativo | None,
    *,
    afecta_colegio: bool = True,
    genera_extra_100: bool = False,
) -> EventoActivo:
    return EventoActivo(
        id=1,
        codigo=codigo,
        nombre=codigo,
        color_hex="#000000",
        afecta_colegio=afecta_colegio,
        afecta_hogar=False,
        genera_extra_100=genera_extra_100,
        fuerza_tipo_dia_operativo=fuerza,
    )


# Fechas de referencia (2026)
LUNES = date(2026, 10, 5)
MARTES = date(2026, 10, 6)
SABADO = date(2026, 10, 3)
DOMINGO = date(2026, 10, 4)


class TestBase:
    def test_lunes_sin_eventos_es_laboral_con_colegio(self) -> None:
        assert resolver_tipo_dia_operativo(LUNES, []) == TipoDiaOperativo.DIA_LABORAL_CON_COLEGIO

    def test_martes_sin_eventos_es_laboral_con_colegio(self) -> None:
        assert resolver_tipo_dia_operativo(MARTES, []) == TipoDiaOperativo.DIA_LABORAL_CON_COLEGIO

    def test_sabado_sin_eventos_es_finde(self) -> None:
        assert resolver_tipo_dia_operativo(SABADO, []) == TipoDiaOperativo.FINDE_FERIADO

    def test_domingo_sin_eventos_es_finde(self) -> None:
        assert resolver_tipo_dia_operativo(DOMINGO, []) == TipoDiaOperativo.FINDE_FERIADO


class TestFeriado:
    def test_lunes_con_feriado_es_finde(self) -> None:
        ev = _ev("FERIADO", TipoDiaOperativo.FINDE_FERIADO, genera_extra_100=True)
        assert resolver_tipo_dia_operativo(LUNES, [ev]) == TipoDiaOperativo.FINDE_FERIADO

    def test_sabado_con_feriado_sigue_finde(self) -> None:
        ev = _ev("FERIADO", TipoDiaOperativo.FINDE_FERIADO, genera_extra_100=True)
        assert resolver_tipo_dia_operativo(SABADO, [ev]) == TipoDiaOperativo.FINDE_FERIADO


class TestVacacionesEscolares:
    def test_lunes_con_vacaciones_es_sin_colegio(self) -> None:
        ev = _ev("VACACIONES_ESCOLARES", TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO)
        assert resolver_tipo_dia_operativo(LUNES, [ev]) == TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO

    def test_sabado_con_vacaciones_sigue_finde(self) -> None:
        ev = _ev("VACACIONES_ESCOLARES", TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO)
        assert resolver_tipo_dia_operativo(SABADO, [ev]) == TipoDiaOperativo.FINDE_FERIADO


class TestSuperposicion:
    def test_feriado_gana_a_vacaciones_en_lunes(self) -> None:
        fer = _ev("FERIADO", TipoDiaOperativo.FINDE_FERIADO, genera_extra_100=True)
        vac = _ev("VACACIONES_ESCOLARES", TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO)
        assert resolver_tipo_dia_operativo(LUNES, [vac, fer]) == TipoDiaOperativo.FINDE_FERIADO

    def test_orden_de_lista_no_importa(self) -> None:
        fer = _ev("FERIADO", TipoDiaOperativo.FINDE_FERIADO, genera_extra_100=True)
        vac = _ev("VACACIONES_ESCOLARES", TipoDiaOperativo.DIA_LABORAL_SIN_COLEGIO)
        assert (
            resolver_tipo_dia_operativo(LUNES, [fer, vac])
            == resolver_tipo_dia_operativo(LUNES, [vac, fer])
        )


class TestEventosSinFuerza:
    def test_evento_sin_fuerza_no_cambia_nada(self) -> None:
        ev = _ev("ALGO", None)
        assert resolver_tipo_dia_operativo(LUNES, [ev]) == TipoDiaOperativo.DIA_LABORAL_CON_COLEGIO


class TestRango:
    def test_dias_del_mes_octubre_2026(self) -> None:
        from app.services.fechas import dias_del_mes

        dias = dias_del_mes(2026, 10)
        assert len(dias) == 31
        assert dias[0] == date(2026, 10, 1)
        assert dias[-1] == date(2026, 10, 31)

    def test_rango_mes_invalido(self) -> None:
        from app.services.fechas import rango_mes

        with pytest.raises(ValueError):
            rango_mes(2026, 13)
