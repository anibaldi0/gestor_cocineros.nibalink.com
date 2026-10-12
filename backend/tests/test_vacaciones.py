"""Tests del calculo de dias de vacaciones. Puros, sin DB. ASCII puro."""

from __future__ import annotations

from datetime import date

import pytest

from app.services.vacaciones import (
    contar_dias_corridos,
    contar_dias_habiles,
)


class TestCorridos:
    def test_5_dias_desde_lunes(self) -> None:
        # Lunes 5/10/2026 + 5 corridos = L-V, hasta 9/10.
        r = contar_dias_corridos(date(2026, 10, 5), 5)
        assert r.desde == date(2026, 10, 5)
        assert r.hasta == date(2026, 10, 9)
        assert r.dias_computados == 5

    def test_30_dias_cruzando_mes(self) -> None:
        r = contar_dias_corridos(date(2026, 12, 15), 30)
        # 15/12 + 29 = 13/01/2027
        assert r.hasta == date(2027, 1, 13)

    def test_un_solo_dia(self) -> None:
        r = contar_dias_corridos(date(2026, 10, 5), 1)
        assert r.desde == r.hasta

    def test_dias_invalidos(self) -> None:
        with pytest.raises(ValueError):
            contar_dias_corridos(date(2026, 10, 5), 0)


class TestHabiles:
    def test_5_habiles_desde_lunes_sin_feriados(self) -> None:
        # Lunes 5/10/2026 + 5 habiles = L-V (9/10).
        r = contar_dias_habiles(date(2026, 10, 5), 5, set())
        assert r.hasta == date(2026, 10, 9)

    def test_5_habiles_desde_lunes_con_finde_en_medio(self) -> None:
        # Lunes 5/10/2026 + 5 habiles: L M X J V (9/10).
        # El finde 10-11/10 queda entre el fin y el regreso.
        r = contar_dias_habiles(date(2026, 10, 5), 5, set())
        assert r.hasta == date(2026, 10, 9)

    def test_saltando_un_feriado(self) -> None:
        # Lunes 12/10/2026 es feriado (Dia del Respeto).
        # Si arranco el 12/10 y cuento 5 habiles:
        #   12/10 feriado -> salteo
        #   13/10 (mar) = 1
        #   14/10 (mie) = 2
        #   15/10 (jue) = 3
        #   16/10 (vie) = 4
        #   17-18/10 finde
        #   19/10 (lun) = 5 -> tope
        feriados = {date(2026, 10, 12)}
        r = contar_dias_habiles(date(2026, 10, 12), 5, feriados)
        assert r.hasta == date(2026, 10, 19)

    def test_arrancando_un_sabado(self) -> None:
        # Sabado 10/10/2026. Con 3 habiles:
        #   10-11/10 finde
        #   12/10 feriado (si lo cargo)
        #   13/10 mar = 1
        #   14/10 mie = 2
        #   15/10 jue = 3
        feriados = {date(2026, 10, 12)}
        r = contar_dias_habiles(date(2026, 10, 10), 3, feriados)
        assert r.hasta == date(2026, 10, 15)

    def test_un_solo_dia_habil(self) -> None:
        r = contar_dias_habiles(date(2026, 10, 5), 1, set())
        assert r.hasta == date(2026, 10, 5)

    def test_dias_invalidos(self) -> None:
        with pytest.raises(ValueError):
            contar_dias_habiles(date(2026, 10, 5), 0, set())
