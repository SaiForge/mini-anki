"""Add Phase 2 feed tables: posts, post_likes, bookmarks, comments

Revision ID: a3f8b2c91d04
Revises: efe1acf4d45f
Create Date: 2026-06-17 16:09:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a3f8b2c91d04'
down_revision: Union[str, Sequence[str], None] = 'efe1acf4d45f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'posts',
        sa.Column('post_id', sa.Uuid(), nullable=False),
        sa.Column('author_id', sa.Uuid(), nullable=False),
        sa.Column('content_type', sa.String(length=20), nullable=True),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('code_snippet', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('is_private', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['author_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('post_id'),
    )
    op.create_index('ix_posts_author_created', 'posts', ['author_id', 'created_at'], unique=False)

    op.create_table(
        'post_likes',
        sa.Column('like_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('post_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['post_id'], ['posts.post_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('like_id'),
        sa.UniqueConstraint('user_id', 'post_id'),
    )

    op.create_table(
        'bookmarks',
        sa.Column('bookmark_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('post_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['post_id'], ['posts.post_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('bookmark_id'),
        sa.UniqueConstraint('user_id', 'post_id'),
    )

    op.create_table(
        'comments',
        sa.Column('comment_id', sa.Uuid(), nullable=False),
        sa.Column('post_id', sa.Uuid(), nullable=False),
        sa.Column('author_id', sa.Uuid(), nullable=False),
        sa.Column('parent_comment_id', sa.Uuid(), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['author_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_comment_id'], ['comments.comment_id']),
        sa.ForeignKeyConstraint(['post_id'], ['posts.post_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('comment_id'),
    )


def downgrade() -> None:
    op.drop_table('comments')
    op.drop_table('bookmarks')
    op.drop_table('post_likes')
    op.drop_index('ix_posts_author_created', table_name='posts')
    op.drop_table('posts')
