"""horas_extra en turno

Revision ID: ac4d5e6f7a8b
Revises: 9b3c2d4e5f6a
Create Date: 2026-10-12 11:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ac4d5e6f7a8b'
down_revision: Union[str, None] = '9b3c2d4e5f6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'turno',
        sa.Column(
            'horas_extra',
            sa.Numeric(5, 2),
            nullable=False,
            server_default='0',
        ),
    )


def downgrade() -> None:
    op.drop_column('turno', 'horas_extra')
