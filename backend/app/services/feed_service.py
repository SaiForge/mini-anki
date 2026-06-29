from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.all_models import Post, Follow
import uuid

class FeedService:
    @staticmethod
    def get_for_you_feed(db: Session, current_user_id: uuid.UUID, cursor: Optional[datetime], limit: int) -> List[Post]:
        following_ids = [
            f.following_id
            for f in db.query(Follow).filter(Follow.follower_id == current_user_id).all()
        ]
        following_ids.append(current_user_id)
        
        query = db.query(Post).filter(
            Post.author_id.in_(following_ids), 
            Post.is_private == False
        )
        if cursor:
            query = query.filter(Post.created_at < cursor)
            
        posts = query.order_by(desc(Post.created_at)).limit(limit).all()
        
        if len(posts) < limit:
            extra_limit = limit - len(posts)
            extra_ids = {p.post_id for p in posts}
            extra_query = db.query(Post).filter(Post.is_private == False)
            if cursor:
                extra_query = extra_query.filter(Post.created_at < cursor)
            if extra_ids:
                extra_query = extra_query.filter(~Post.post_id.in_(extra_ids))
            extra_posts = extra_query.order_by(desc(Post.created_at)).limit(extra_limit).all()
            posts.extend(extra_posts)
            
        return posts

    @staticmethod
    def get_following_feed(db: Session, current_user_id: uuid.UUID, cursor: Optional[datetime], limit: int) -> List[Post]:
        following_ids = [
            f.following_id
            for f in db.query(Follow).filter(Follow.follower_id == current_user_id).all()
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
