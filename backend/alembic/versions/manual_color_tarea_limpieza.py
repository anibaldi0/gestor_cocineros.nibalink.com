"""color_hex en tipo_tarea_limpieza

Revision ID: bd5e6f7a8b9c
Revises: ac4d5e6f7a8b
Create Date: 2026-10-12 18:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'bd5e6f7a8b9c'
down_revision: Union[str, None] = 'ac4d5e6f7a8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tipo_tarea_limpieza',
        sa.Column(
            'color_hex',
            sa.String(length=7),
            nullable=False,
            server_default='#94a3b8',
        ),
    )


def downgrade() -> None:
    op.drop_column('tipo_tarea_limpieza', 'color_hex')
