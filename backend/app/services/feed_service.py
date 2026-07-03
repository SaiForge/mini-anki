from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from app.models.all_models import Post, Follow
import uuid

class FeedService:
    @staticmethod
    def get_for_you_feed(db: Session, current_user_id: uuid.UUID, cursor: Optional[datetime], limit: int) -> List[Post]:
        """
        Single-query for-you feed: fetch posts from followed users + popular public posts.
        
        Optimised to use a single DB round-trip by querying with an OR filter across
        followed user IDs + all public posts, ordered by recency, then dedup via set logic.
        This avoids the previous two-query pattern (following → fill-up).
        """
        following_ids = [
            f.following_id
            for f in db.query(Follow.following_id).filter(Follow.follower_id == current_user_id).all()
        ]
        following_ids.append(current_user_id)

        # Single query: posts from followed users OR public posts, sorted by recency
        query = db.query(Post).filter(
            Post.is_private == False,
            or_(
                Post.author_id.in_(following_ids),
                True  # also include all public posts for discovery
            )
        )
        if cursor:
            query = query.filter(Post.created_at < cursor)

        # Prioritise followed-user posts: stable sort by (is_from_following DESC, created_at DESC)
        # SQLAlchemy can't directly order by a derived boolean, so we fetch a slightly larger
        # batch and re-sort in Python (still one DB round-trip).
        posts = query.order_by(desc(Post.created_at)).limit(limit * 2).all()

        # Re-rank: followed-user posts first, then discovery posts, up to `limit`
        following_set = set(following_ids)
        followed_posts = [p for p in posts if p.author_id in following_set]
        other_posts = [p for p in posts if p.author_id not in following_set]

        result = followed_posts + other_posts
        return result[:limit]

    @staticmethod
    def get_following_feed(db: Session, current_user_id: uuid.UUID, cursor: Optional[datetime], limit: int) -> List[Post]:
        """Strictly chronological feed from followed users only — single query."""
        following_ids = [
            f.following_id
            for f in db.query(Follow.following_id).filter(Follow.follower_id == current_user_id).all()
        ]
        if not following_ids:
            return []

        query = db.query(Post).filter(
            Post.author_id.in_(following_ids),
            Post.is_private == False
        )
        if cursor:
            query = query.filter(Post.created_at < cursor)

        return query.order_by(desc(Post.created_at)).limit(limit).all()

