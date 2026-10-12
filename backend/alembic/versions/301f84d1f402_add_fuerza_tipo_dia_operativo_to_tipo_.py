"""add fuerza_tipo_dia_operativo to tipo_evento_calendario

Revision ID: 301f84d1f402
Revises: 83970ec9f85e
Create Date: 2026-10-11 17:24:18.514314
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '301f84d1f402'
down_revision: Union[str, None] = '83970ec9f85e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # El tipo ENUM ya existe (lo creo la migracion inicial). Reutilizarlo.
    op.add_column(
        'tipo_evento_calendario',
        sa.Column(
            'fuerza_tipo_dia_operativo',
            postgresql.ENUM(
                'DIA_LABORAL_CON_COLEGIO',
                'DIA_LABORAL_SIN_COLEGIO',
                'FINDE_FERIADO',
                name='tipo_dia_operativo_enum',
                create_type=False,
            ),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column('tipo_evento_calendario', 'fuerza_tipo_dia_operativo')
