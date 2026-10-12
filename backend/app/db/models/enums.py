"""Enums del dominio. Todos heredan de str, Enum para que Pydantic los
serialice directo y SQLAlchemy los mapee a tipos nativos de Postgres."""

from enum import Enum


class TipoDiaOperativo(str, Enum):
    DIA_LABORAL_CON_COLEGIO = "DIA_LABORAL_CON_COLEGIO"
    DIA_LABORAL_SIN_COLEGIO = "DIA_LABORAL_SIN_COLEGIO"
    FINDE_FERIADO = "FINDE_FERIADO"


class Rol(str, Enum):
    SUPERADMIN = "SUPERADMIN"
    EDITOR = "EDITOR"
    EMPLEADO = "EMPLEADO"


class EstadoTurno(str, Enum):
    TRABAJO = "TRABAJO"
    FRANCO = "FRANCO"
    VACACIONES = "VACACIONES"
    LICENCIA_MEDICA = "LICENCIA_MEDICA"
    ART = "ART"
    LICENCIA_ESPECIAL = "LICENCIA_ESPECIAL"
    AUSENCIA_INJUSTIFICADA = "AUSENCIA_INJUSTIFICADA"


class TipoNovedad(str, Enum):
    VACACIONES = "VACACIONES"
    LICENCIA_MEDICA = "LICENCIA_MEDICA"
    ART = "ART"
    LICENCIA_ESPECIAL = "LICENCIA_ESPECIAL"
    AUSENCIA_INJUSTIFICADA = "AUSENCIA_INJUSTIFICADA"


class EstadoNovedad(str, Enum):
    ACTIVA = "ACTIVA"
    FINALIZADA = "FINALIZADA"
    CANCELADA = "CANCELADA"


class ModoConteo(str, Enum):
    CORRIDOS = "CORRIDOS"
    HABILES = "HABILES"


class EstadoVacacionesAnuales(str, Enum):
    ABIERTA = "ABIERTA"
    CERRADA = "CERRADA"


class TipoHoraExtra(str, Enum):
    AL_50 = "AL_50"
    AL_100 = "AL_100"
    NOCTURNA = "NOCTURNA"


class TipoAjusteHoras(str, Enum):
    EXTRA = "EXTRA"
    DEUDA = "DEUDA"
    COMPENSACION = "COMPENSACION"


class EstadoColaLimpieza(str, Enum):
    EN_COLA = "EN_COLA"
    PAUSADO = "PAUSADO"


class OrigenAsignacionLimpieza(str, Enum):
    AUTO = "AUTO"
    MANUAL = "MANUAL"


class EstadoCicloLimpieza(str, Enum):
    ABIERTO = "ABIERTO"
    CERRADO = "CERRADO"


class EstadoPeriodoGrilla(str, Enum):
    BORRADOR = "BORRADOR"
    PUBLICADO = "PUBLICADO"


class EstadoAlerta(str, Enum):
    ACTIVA = "ACTIVA"
    RESUELTA = "RESUELTA"
    IGNORADA = "IGNORADA"


class TipoConfiguracion(str, Enum):
    INT = "INT"
    FLOAT = "FLOAT"
    STRING = "STRING"
    BOOL = "BOOL"


class ContextoFranja(str, Enum):
    """Contexto en el que aplica una franja.

    - LABORAL: dias L-V (con o sin colegio).
    - FINDE: sabados y domingos no feriados.
    - FERIADO: cualquier dia feriado, sea L-V o finde.

    Un lunes feriado usa FERIADO. Un sabado normal usa FINDE.
    """

    LABORAL = "LABORAL"
    FINDE = "FINDE"
    FERIADO = "FERIADO"
