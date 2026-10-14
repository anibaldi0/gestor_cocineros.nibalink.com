"""login_evento

Revision ID: ce6f7a8b9c0d
Revises: bd5e6f7a8b9c
Create Date: 2026-10-13 10:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ce6f7a8b9c0d'
down_revision: Union[str, None] = 'bd5e6f7a8b9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'login_evento',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=False),
        sa.Column(
            'fecha',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['usuario_id'], ['usuario.id'], ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_login_evento_usuario_fecha',
        'login_evento',
        ['usuario_id', 'fecha'],
    )


def downgrade() -> None:
    op.drop_index('ix_login_evento_usuario_fecha', table_name='login_evento')
    op.drop_table('login_evento')
