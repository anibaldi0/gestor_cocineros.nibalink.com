"""Generador de passwords memorables de 3 palabras ASCII.

Formato: sujetoverbosustantivo sin separadores (ej: "tigrecomepan").

Reglas:
- ASCII puro en el diccionario (sin tildes ni enie).
- Sin caracteres ambiguos al dictar (nada de numeros ni simbolos raros).
- Solo se usa para passwords temporales que el usuario debe cambiar en
  el primer login.
"""

from __future__ import annotations

import secrets


SUJETOS: tuple[str, ...] = (
    "juan", "maria", "pedro", "lola", "ana", "luis", "sofia", "diego",
    "tigre", "gato", "perro", "pato", "caballo", "vaca", "oveja", "leon",
    "nino", "nina", "abuelo", "abuela", "tio", "tia", "primo", "prima",
    "capitan", "doctor", "maestro", "chef", "jardinero", "pintor",
    "roble", "pino", "olivo", "sauce", "cedro", "nogal",
)

VERBOS: tuple[str, ...] = (
    "come", "corre", "baila", "canta", "salta", "pinta", "limpia",
    "corta", "pela", "mezcla", "hornea", "sirve", "prueba", "mira",
    "busca", "toma", "lleva", "abre", "cierra", "guarda", "ordena",
    "lava", "seca", "plancha", "barre", "trae", "lleva", "deja",
)

SUSTANTIVOS: tuple[str, ...] = (
    "pan", "sopa", "torta", "flan", "arroz", "fideo", "papa", "tomate",
    "queso", "leche", "cafe", "te", "jugo", "agua", "sal", "azucar",
    "plato", "vaso", "taza", "cuchara", "tenedor", "cuchillo", "olla",
    "mesa", "silla", "puerta", "ventana", "llave", "libro", "papel",
    "campo", "casa", "calle", "plaza", "rio", "mar", "monte", "cerro",
    "flor", "hoja", "fruto", "semilla", "tallo", "raiz", "rama",
)


def generar_password_temporal() -> str:
    """Devuelve una password tipo 'sujetoverbosustantivo' (sin guiones)."""
    s = secrets.choice(SUJETOS)
    v = secrets.choice(VERBOS)
    n = secrets.choice(SUSTANTIVOS)
    return f"{s}{v}{n}"
