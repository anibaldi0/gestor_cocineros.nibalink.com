"""contexto en franja

Revision ID: 9b3c2d4e5f6a
Revises: 8a2b1c3d4e5f
Create Date: 2026-10-12 10:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '9b3c2d4e5f6a'
down_revision: Union[str, None] = '8a2b1c3d4e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Crear el tipo enum y agregar la columna.
    contexto_enum = postgresql.ENUM(
        'LABORAL', 'FINDE', 'FERIADO',
        name='contexto_franja_enum',
        create_type=True,
    )
    contexto_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        'franja',
        sa.Column(
            'contexto',
            postgresql.ENUM(
                'LABORAL', 'FINDE', 'FERIADO',
                name='contexto_franja_enum',
                create_type=False,
            ),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column('franja', 'contexto')
    postgresql.ENUM(name='contexto_franja_enum').drop(
        op.get_bind(), checkfirst=True
    )
