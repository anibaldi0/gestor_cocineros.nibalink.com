"""Reune Base + todos los modelos para que Alembic los descubra al autogenerar.
Importar este modulo es requisito antes de cualquier autogenerate."""

from app.db.session import Base  # noqa: F401

# Importar cada modulo de modelos para poblar Base.metadata.
from app.db.models import (  # noqa: F401
    alerta,
    auditoria,
    calendario,
    configuracion as config_model,
    jornada,
    limpieza,
    operativa,
    personas,
    publicacion,
)

__all__ = ["Base"]
