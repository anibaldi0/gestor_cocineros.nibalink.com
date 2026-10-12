"""Grilla y CF: codigo_corto en franja, CF en turno, unique (empleado, fecha)

Revision ID: 8a2b1c3d4e5f
Revises: 301f84d1f402
Create Date: 2026-10-11 19:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8a2b1c3d4e5f'
down_revision: Union[str, None] = '301f84d1f402'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. franja.codigo_corto
    op.add_column(
        'franja',
        sa.Column('codigo_corto', sa.String(length=3), nullable=True),
    )

    # 2. turno.es_franco_protegido y turno.nota
    op.add_column(
        'turno',
        sa.Column(
            'es_franco_protegido',
            sa.Boolean(),
            nullable=False,
            server_default='false',
        ),
    )
    op.add_column(
        'turno',
        sa.Column('nota', sa.String(length=200), nullable=True),
    )

    # 3. Drop indices parciales viejos
    op.drop_index('uq_turno_trabajo_empleado_fecha_franja', table_name='turno')
    op.drop_index('uq_turno_no_trabajo_empleado_fecha', table_name='turno')

    # 4. Unique (empleado_id, fecha)
    op.create_unique_constraint(
        'uq_turno_empleado_fecha',
        'turno',
        ['empleado_id', 'fecha'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_turno_empleado_fecha', 'turno', type_='unique')

    op.create_index(
        'uq_turno_no_trabajo_empleado_fecha',
        'turno',
        ['empleado_id', 'fecha'],
        unique=True,
        postgresql_where=sa.text("estado != 'TRABAJO'"),
    )
    op.create_index(
        'uq_turno_trabajo_empleado_fecha_franja',
        'turno',
        ['empleado_id', 'fecha', 'franja_id'],
        unique=True,
        postgresql_where=sa.text("estado = 'TRABAJO'"),
    )

    op.drop_column('turno', 'nota')
    op.drop_column('turno', 'es_franco_protegido')
    op.drop_column('franja', 'codigo_corto')
