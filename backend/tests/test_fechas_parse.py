"""Tests del parser de fechas. Puros, sin DB. ASCII puro."""

from __future__ import annotations

from datetime import date

import pytest

from app.core.fechas_parse import parse_fecha


class TestISO:
    def test_iso_estandar(self) -> None:
        assert parse_fecha("2026-10-11") == date(2026, 10, 11)

    def test_iso_con_barras(self) -> None:
        assert parse_fecha("2026/10/11") == date(2026, 10, 11)


class TestConBarras:
    def test_dd_mm_yyyy(self) -> None:
        assert parse_fecha("11/10/2026") == date(2026, 10, 11)

    def test_dd_mm_yyyy_con_guiones(self) -> None:
        assert parse_fecha("11-10-2026") == date(2026, 10, 11)


class TestCompacto:
    def test_ocho_digitos(self) -> None:
        assert parse_fecha("11102026") == date(2026, 10, 11)

    def test_ocho_digitos_con_espacios(self) -> None:
        assert parse_fecha("  11102026  ") == date(2026, 10, 11)


class TestTypeDirecto:
    def test_date_se_devuelve_tal_cual(self) -> None:
        d = date(2026, 10, 11)
        assert parse_fecha(d) == d


class TestErrores:
    def test_vacio(self) -> None:
        with pytest.raises(ValueError):
            parse_fecha("")

    def test_demasiado_corto(self) -> None:
        with pytest.raises(ValueError):
            parse_fecha("1110")

    def test_dia_invalido(self) -> None:
        with pytest.raises(ValueError):
            parse_fecha("32102026")

    def test_mes_invalido(self) -> None:
        with pytest.raises(ValueError):
            parse_fecha("11302026")

    def test_anio_muy_viejo(self) -> None:
        with pytest.raises(ValueError):
            parse_fecha("11101850")

    def test_febrero_29_no_bisiesto(self) -> None:
        with pytest.raises(ValueError):
            parse_fecha("29022025")

    def test_febrero_29_bisiesto(self) -> None:
        assert parse_fecha("29022024") == date(2024, 2, 29)
