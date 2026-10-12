"""Normalizacion de campos de texto del dominio.

Reglas:
- DNI: solo digitos, entre 6 y 10.
- Nombre/Apellido: trim, colapso de espacios internos, y capitalizacion
  por palabra (primera letra mayuscula, resto minuscula) SIEMPRE.
  Esto prioriza consistencia sobre casos borde: "McDonald" -> "Mcdonald",
  "de la Cruz" -> "De La Cruz". El editor puede corregir a mano despues.
- No se "adivinan" tildes: si el usuario escribe "maria" queda "Maria";
  si escribe "Maria" con tilde, respetamos lo que vino.

REGLA DE PROYECTO: este archivo debe ser ASCII puro.
Los strings de prueba con tildes se escriben con escapes \\uXXXX.
"""

from __future__ import annotations


DNI_MIN = 6
DNI_MAX = 10
NOMBRE_MAX = 100
TELEFONO_MAX = 40


def normalizar_dni(valor: str) -> str:
    """Deja solo los digitos del DNI. Falla si queda fuera de rango."""
    solo_digitos = "".join(c for c in valor if c.isdigit())
    if not (DNI_MIN <= len(solo_digitos) <= DNI_MAX):
        raise ValueError(
            f"DNI invalido: se esperaban entre {DNI_MIN} y {DNI_MAX} digitos"
        )
    return solo_digitos


def _capitalizar_palabra(p: str) -> str:
    """Primera letra mayuscula, resto minuscula. Respeta tildes y enie
    porque upper/lower en Python funcionan sobre caracteres Unicode."""
    if not p:
        return p
    return p[0].upper() + p[1:].lower()


def normalizar_nombre(valor: str) -> str:
    """Trim, colapso de espacios, capitalizacion por palabra."""
    s = " ".join(valor.split())
    if not s:
        return s
    return " ".join(_capitalizar_palabra(p) for p in s.split(" "))


def normalizar_telefono(valor: str | None) -> str | None:
    """Trim simple. Deja el formato como lo escribio el usuario."""
    if valor is None:
        return None
    s = valor.strip()
    return s or None


def normalizar_texto_libre(valor: str | None) -> str | None:
    """Trim y colapso de espacios internos en textos libres."""
    if valor is None:
        return None
    s = " ".join(valor.split())
    return s or None
