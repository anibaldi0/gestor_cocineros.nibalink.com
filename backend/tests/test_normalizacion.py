"""Tests de normalizacion. Puros, sin DB.

REGLA DE PROYECTO: este archivo debe ser ASCII puro.
Los casos con tildes/enie se escriben con escapes \\uXXXX.
"""

from __future__ import annotations

import pytest

from app.core.normalizacion import (
    normalizar_dni,
    normalizar_nombre,
    normalizar_telefono,
    normalizar_texto_libre,
)


# Escapes unicode de referencia:
#   \u00e1 = a minuscula con tilde aguda
#   \u00e9 = e minuscula con tilde aguda
#   \u00ed = i minuscula con tilde aguda
#   \u00f3 = o minuscula con tilde aguda
#   \u00fa = u minuscula con tilde aguda
#   \u00f1 = enie minuscula
#   \u00d1 = enie mayuscula
#   \u00cd = I mayuscula con tilde aguda
#   \u00c9 = E mayuscula con tilde aguda
#   \u00c1 = A mayuscula con tilde aguda
#   \u00d3 = O mayuscula con tilde aguda
#   \u00da = U mayuscula con tilde aguda


class TestDNI:
    def test_solo_digitos(self) -> None:
        assert normalizar_dni("25354223") == "25354223"

    def test_con_puntos(self) -> None:
        assert normalizar_dni("25.354.223") == "25354223"

    def test_con_guiones_y_espacios(self) -> None:
        assert normalizar_dni(" 25-354-223 ") == "25354223"

    def test_demasiado_corto(self) -> None:
        with pytest.raises(ValueError):
            normalizar_dni("123")

    def test_demasiado_largo(self) -> None:
        with pytest.raises(ValueError):
            normalizar_dni("1" * 11)


class TestNombre:
    def test_todo_minusculas_se_capitaliza(self) -> None:
        assert normalizar_nombre("maria alejandra") == "Maria Alejandra"

    def test_todo_mayusculas_se_normaliza(self) -> None:
        assert normalizar_nombre("MARIA ALEJANDRA PEPONA") == "Maria Alejandra Pepona"

    def test_mixto_por_palabra_se_normaliza(self) -> None:
        assert normalizar_nombre("maria ALEjandra Pepona") == "Maria Alejandra Pepona"

    def test_mezcla_desprolija(self) -> None:
        assert normalizar_nombre("  maria ALEJANDRA  ") == "Maria Alejandra"

    def test_con_tildes_preserva_acentos(self) -> None:
        # Input: "MARIA JOSE" con tildes. Output: "Maria Jose" con tildes.
        entrada = "MAR\u00cdA JOS\u00c9"
        esperado = "Mar\u00eda Jos\u00e9"
        assert normalizar_nombre(entrada) == esperado

    def test_con_enie_preserva(self) -> None:
        # Input: "MUNOZ" con enie mayuscula. Output: "Munoz" con enie minuscula.
        entrada = "MU\u00d1OZ"
        esperado = "Mu\u00f1oz"
        assert normalizar_nombre(entrada) == esperado

    def test_espacios_multiples_colapsan(self) -> None:
        assert normalizar_nombre("  maria   alejandra  ") == "Maria Alejandra"

    def test_vacio(self) -> None:
        assert normalizar_nombre("   ") == ""


class TestTelefono:
    def test_trim(self) -> None:
        assert normalizar_telefono("  11-5555-0001  ") == "11-5555-0001"

    def test_vacio_es_none(self) -> None:
        assert normalizar_telefono("   ") is None

    def test_none(self) -> None:
        assert normalizar_telefono(None) is None


class TestTextoLibre:
    def test_trim_y_colapso(self) -> None:
        assert normalizar_texto_libre("  hola   mundo  ") == "hola mundo"

    def test_vacio_es_none(self) -> None:
        assert normalizar_texto_libre("   ") is None
