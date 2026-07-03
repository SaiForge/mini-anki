"""add ai_sessions table

Revision ID: e4ec8g8d085e
Revises: d3db7f7c974d
Create Date: 2026-07-03 13:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4ec8g8d085e'
down_revision: Union[str, Sequence[str], None] = 'd3db7f7c974d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('ai_sessions',
    sa.Column('session_id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('mode', sa.String(length=50), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=True),
    sa.Column('data', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('session_id')
    )


def downgrade() -> None:
    op.drop_table('ai_sessions')
