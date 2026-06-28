"""Phase 3: Deck sharing fields + DeckLike table

Revision ID: c2d4e5f60718
Revises: b1c9e3d4f502
Create Date: 2026-06-18 15:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c2d4e5f60718'
down_revision: Union[str, Sequence[str], None] = 'b1c9e3d4f502'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add sharing columns to decks table
    with op.batch_alter_table('decks') as batch_op:
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('category', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('is_public', sa.Boolean(), nullable=True, server_default='false'))
        batch_op.add_column(sa.Column('fork_count', sa.Integer(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('like_count', sa.Integer(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column(
            'original_deck_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('decks.deck_id'),
            nullable=True
        ))

    # Create deck_likes table
    op.create_table(
        'deck_likes',
        sa.Column('like_id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('deck_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['deck_id'], ['decks.deck_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('like_id'),
        sa.UniqueConstraint('user_id', 'deck_id', name='uq_deck_likes_user_deck'),
    )

    # Performance indexes
    op.create_index('idx_decks_is_public', 'decks', ['is_public', 'created_at'])
    op.create_index('idx_deck_likes_deck', 'deck_likes', ['deck_id'])


def downgrade() -> None:
    op.drop_index('idx_deck_likes_deck', table_name='deck_likes')
    op.drop_index('idx_decks_is_public', table_name='decks')
    op.drop_table('deck_likes')
    with op.batch_alter_table('decks') as batch_op:
        batch_op.drop_column('original_deck_id')
        batch_op.drop_column('like_count')
        batch_op.drop_column('fork_count')
        batch_op.drop_column('is_public')
        batch_op.drop_column('category')
        batch_op.drop_column('description')
