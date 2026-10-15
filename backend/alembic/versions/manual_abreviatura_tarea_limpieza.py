"""abreviatura en tipo_tarea_limpieza

Revision ID: df7a8b9c0d1e
Revises: ce6f7a8b9c0d
Create Date: 2026-10-15 10:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'df7a8b9c0d1e'
down_revision: Union[str, None] = 'ce6f7a8b9c0d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tipo_tarea_limpieza',
        sa.Column(
            'abreviatura',
            sa.String(length=10),
            nullable=False,
            server_default='?',
        ),
    )


def downgrade() -> None:
    op.drop_column('tipo_tarea_limpieza', 'abreviatura')
