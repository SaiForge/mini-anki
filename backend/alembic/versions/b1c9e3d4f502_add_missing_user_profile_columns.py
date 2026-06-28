"""Add missing user profile columns: website_url, location, is_public, tags

Revision ID: b1c9e3d4f502
Revises: a3f8b2c91d04
Create Date: 2026-06-18 14:46:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b1c9e3d4f502'
down_revision: Union[str, Sequence[str], None] = 'a3f8b2c91d04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns that exist in the model but are missing from the old DB
    # Use IF NOT EXISTS-style try/except so this is safe to re-run
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('website_url', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('location', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('is_public', sa.Boolean(), nullable=True, server_default='true'))
        batch_op.add_column(sa.Column('tags', sa.JSON(), nullable=True))
        # Widen profile_picture_url from VARCHAR(255) to VARCHAR(500)
        batch_op.alter_column(
            'profile_picture_url',
            type_=sa.String(length=500),
            existing_type=sa.String(length=255),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('tags')
        batch_op.drop_column('is_public')
        batch_op.drop_column('location')
        batch_op.drop_column('website_url')
        batch_op.alter_column(
            'profile_picture_url',
            type_=sa.String(length=255),
            existing_type=sa.String(length=500),
            existing_nullable=True,
        )
