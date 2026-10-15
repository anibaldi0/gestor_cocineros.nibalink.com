"""firma de limpieza

Revision ID: e08b9c0d1e2f
Revises: df7a8b9c0d1e
Create Date: 2026-10-15 14:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e08b9c0d1e2f'
down_revision: Union[str, None] = 'df7a8b9c0d1e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'asignacion_limpieza',
        sa.Column('firmada_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'asignacion_limpieza',
        sa.Column(
            'firmada_por_usuario_id',
            sa.Integer(),
            sa.ForeignKey(
                'usuario.id',
                ondelete='SET NULL',
                name='asignacion_limpieza_firmada_por_fkey',
            ),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_constraint(
        'asignacion_limpieza_firmada_por_fkey',
        'asignacion_limpieza',
        type_='foreignkey',
    )
    op.drop_column('asignacion_limpieza', 'firmada_por_usuario_id')
    op.drop_column('asignacion_limpieza', 'firmada_at')
