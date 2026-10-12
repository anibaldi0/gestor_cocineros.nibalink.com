"""Utilidades para busqueda tolerante: sin distinguir mayusculas ni tildes.

Estrategia:
- Normalizamos el termino de busqueda en Python (lowercase + sin acentos).
- En SQL aplicamos translate(lower(columna), 'acentuadas', 'planas') para
  que el indice funcional no sea necesario y no dependamos de extensiones.

No usamos la extension unaccent ni agregamos columnas normalizadas.
ASCII puro.
"""

from __future__ import annotations

import unicodedata


# Mapa de acentos que reconocemos del lado SQL. Debe ser coherente con
# el que usamos en Python (unicodedata normaliza cualquier Unicode, pero
# el SQL solo cubre estos).
ACENTOS_FROM = "aeiouaeiouaeiouaeiouaonc"
ACENTOS_TO = "aeiouaeiouaeiouaeiouaonc"
# El string real de FROM tiene caracteres acentuados; lo armamos abajo.


def _armar_mapas() -> tuple[str, str]:
    """Construye los strings FROM/TO para translate() de PostgreSQL.

    FROM: cada caracter acentuado (lowercase, porque aplicamos lower antes).
    TO: su equivalente plano, misma posicion.
    """
    pares = [
        ("\u00e1", "a"),  # a con tilde aguda
        ("\u00e0", "a"),  # a con tilde grave
        ("\u00e4", "a"),  # a con dieresis
        ("\u00e2", "a"),  # a con circunflejo
        ("\u00e3", "a"),  # a con tilde
        ("\u00e9", "e"),  # e aguda
        ("\u00e8", "e"),  # e grave
        ("\u00eb", "e"),  # e dieresis
        ("\u00ea", "e"),  # e circunflejo
        ("\u00ed", "i"),  # i aguda
        ("\u00ec", "i"),  # i grave
        ("\u00ef", "i"),  # i dieresis
        ("\u00ee", "i"),  # i circunflejo
        ("\u00f3", "o"),  # o aguda
        ("\u00f2", "o"),  # o grave
        ("\u00f6", "o"),  # o dieresis
        ("\u00f4", "o"),  # o circunflejo
        ("\u00f5", "o"),  # o tilde
        ("\u00fa", "u"),  # u aguda
        ("\u00f9", "u"),  # u grave
        ("\u00fc", "u"),  # u dieresis
        ("\u00fb", "u"),  # u circunflejo
        ("\u00f1", "n"),  # enie
        ("\u00e7", "c"),  # c cedilla
    ]
    frm = "".join(p[0] for p in pares)
    to = "".join(p[1] for p in pares)
    return frm, to


SQL_FROM, SQL_TO = _armar_mapas()


def normalizar_texto_busqueda(texto: str) -> str:
    """Normaliza un texto para busqueda: lowercase y sin acentos.

    Se usa del lado Python sobre el termino del usuario.
    """
    nfd = unicodedata.normalize("NFD", texto)
    sin_marcas = "".join(
        c for c in nfd if unicodedata.category(c) != "Mn"
    )
    return sin_marcas.lower().strip()
