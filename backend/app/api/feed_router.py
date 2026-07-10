import uuid
from typing import Optional, List
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, Field, validator
from app.db.database import get_db
from app.models.all_models import User, Post, PostLike, Bookmark, Comment, Follow
from app.api.deps import get_current_user
from app.api.notification_router import create_notification
from app.db.redis import get_cache_sync, set_cache_sync

router = APIRouter(tags=["Feed"])


# ─── Pydantic Schemas ──────────────────────────────────────────────────────────

# SECURITY FIX (High #8): SSRF-safe image URL validator
# WHY: Without this, a malicious user could store a URL like
# http://169.254.169.254/latest/meta-data/ (AWS metadata service) and if the
# backend ever fetches it, an attacker gains cloud credentials.
_BLOCKED_HOSTS = (
    "169.254.",   # AWS/Azure link-local metadata
    "10.",        # RFC-1918 private
    "192.168.",   # RFC-1918 private
    "172.16.",    # RFC-1918 private
    "127.",       # loopback
    "localhost",  # loopback hostname
    "metadata",   # cloud metadata keyword
    "0.0.0.0",
)

def _validate_image_url(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    try:
        parsed = urlparse(v)
    except Exception:
        raise ValueError("Invalid URL format")
    if parsed.scheme != "https":
        raise ValueError("Only HTTPS image URLs are allowed")
    hostname = (parsed.hostname or "").lower()
    if any(hostname.startswith(b) for b in _BLOCKED_HOSTS):
        raise ValueError("Internal or metadata URLs are not allowed")
    return v


class PostCreate(BaseModel):
    content_type: str = "CONCEPT"
    title: Optional[str] = Field(None, max_length=300)
    body: str = Field(..., min_length=1, max_length=10000)
    code_snippet: Optional[str] = Field(None, max_length=20000)
    image_url: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    is_private: bool = False
    deck_id: Optional[uuid.UUID] = None

    # SECURITY FIX (High #8): Validate image_url against SSRF block list
    @validator("image_url")
    def validate_image_url(cls, v):
        return _validate_image_url(v)


class PostUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=300)
    body: Optional[str] = Field(None, max_length=10000)
    code_snippet: Optional[str] = Field(None, max_length=20000)
    image_url: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    is_private: Optional[bool] = None

    @validator("image_url")
    def validate_image_url(cls, v):
        return _validate_image_url(v)


class CommentCreate(BaseModel):
    body: str
    parent_comment_id: Optional[uuid.UUID] = None


from sqlalchemy import desc, func

def _serialize_posts_batched(posts: List[Post], current_user_id, db: Session) -> List[dict]:
    """Convert Post ORM objects to JSON-safe dicts with batched like/bookmark status."""
    if not posts:
        return []
        
    post_ids = [p.post_id for p in posts]
    
    like_counts = dict(db.query(PostLike.post_id, func.count(PostLike.like_id)).filter(PostLike.post_id.in_(post_ids)).group_by(PostLike.post_id).all())
    comment_counts = dict(db.query(Comment.post_id, func.count(Comment.comment_id)).filter(Comment.post_id.in_(post_ids)).group_by(Comment.post_id).all())
    bookmark_counts = dict(db.query(Bookmark.post_id, func.count(Bookmark.bookmark_id)).filter(Bookmark.post_id.in_(post_ids)).group_by(Bookmark.post_id).all())
    
    liked_post_ids = {row[0] for row in db.query(PostLike.post_id).filter(PostLike.post_id.in_(post_ids), PostLike.user_id == current_user_id).all()}
    bookmarked_post_ids = {row[0] for row in db.query(Bookmark.post_id).filter(Bookmark.post_id.in_(post_ids), Bookmark.user_id == current_user_id).all()}
    
    author_ids = list({p.author_id for p in posts})
    followed_author_ids = {row[0] for row in db.query(Follow.following_id).filter(Follow.following_id.in_(author_ids), Follow.follower_id == current_user_id).all()}
    
    result = []
    for post in posts:
        author = post.author
        result.append({
            "post_id": str(post.post_id),
            "author_id": str(post.author_id),
            "author_username": author.username if author else None,
            "author_full_name": author.full_name if author else None,
            "author_avatar_url": None,
            "author_streak": author.current_streak if author else 0,
            "content_type": post.content_type,
            "title": post.title,
            "body": post.body,
            "code_snippet": post.code_snippet,
            "image_url": post.image_url,
            "category": post.category,
            "is_private": post.is_private,
            "created_at": post.created_at.isoformat() if post.created_at else None,
            "likes_count": like_counts.get(post.post_id, 0),
            "comments_count": comment_counts.get(post.post_id, 0),
            "bookmarks_count": bookmark_counts.get(post.post_id, 0),
            "is_liked": post.post_id in liked_post_ids,
            "is_bookmarked": post.post_id in bookmarked_post_ids,
            "is_followed": post.author_id in followed_author_ids,
        })
    return result


# ─── Posts CRUD ─────────────────────────────────────────────────────────────────

@router.post("/api/posts", status_code=status.HTTP_201_CREATED)
def create_post(
    payload: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = Post(
        author_id=current_user.user_id,
        content_type=payload.content_type,
        title=payload.title,
        body=payload.body,
        code_snippet=payload.code_snippet,
        image_url=payload.image_url,
        category=payload.category,
        is_private=payload.is_private,
        deck_id=payload.deck_id,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _serialize_posts_batched([post], current_user.user_id, db)[0]


@router.get("/api/posts/{post_id}")
def get_post(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.is_private and post.author_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="This post is private")
    return _serialize_posts_batched([post], current_user.user_id, db)[0]


@router.put("/api/posts/{post_id}")
def update_post(
    post_id: uuid.UUID,
    payload: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your post")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(post, field, value)
    db.commit()
    db.refresh(post)
    return _serialize_posts_batched([post], current_user.user_id, db)[0]


@router.delete("/api/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your post")
    db.delete(post)
    db.commit()


from app.services.feed_service import FeedService
from datetime import datetime

# ─── Feed Endpoints ─────────────────────────────────────────────────────────────

@router.get("/api/feed/for-you")
def get_for_you_feed(
    cursor: Optional[datetime] = None,
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns posts from followed users + popular posts, newest first."""
    cache_key = f"feed:foryou:{current_user.user_id}:{limit}"
    if cursor: cache_key += f":{cursor.isoformat()}"
    cached = get_cache_sync(cache_key)
    if cached: return cached

    posts = FeedService.get_for_you_feed(db, current_user.user_id, cursor, limit)
    result = _serialize_posts_batched(posts, current_user.user_id, db)
    
    set_cache_sync(cache_key, result, expire_seconds=120)
    return result


@router.get("/api/feed/following")
def get_following_feed(
    cursor: Optional[datetime] = None,
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Strictly chronological feed from followed users only."""
    cache_key = f"feed:following:{current_user.user_id}:{limit}"
    if cursor: cache_key += f":{cursor.isoformat()}"
    cached = get_cache_sync(cache_key)
    if cached: return cached

    posts = FeedService.get_following_feed(db, current_user.user_id, cursor, limit)
    result = _serialize_posts_batched(posts, current_user.user_id, db)
    
    set_cache_sync(cache_key, result, expire_seconds=120)
    return result


@router.get("/api/users/{user_id}/posts")
def get_user_posts(
    user_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return public posts by a specific user."""
    is_own = (user_id == current_user.user_id)
    query = db.query(Post).filter(Post.author_id == user_id)
    if not is_own:
        query = query.filter(Post.is_private == False)
    posts = query.order_by(desc(Post.created_at)).offset(skip).limit(limit).all()
    return _serialize_posts_batched(posts, current_user.user_id, db)


# ─── Likes ──────────────────────────────────────────────────────────────────────

@router.post("/api/posts/{post_id}/like", status_code=status.HTTP_200_OK)
def like_post(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(PostLike).filter(
        PostLike.post_id == post_id, PostLike.user_id == current_user.user_id
    ).first()
    # Use COUNT scalar — avoids loading all PostLike rows into memory
    likes_count = db.query(func.count(PostLike.like_id)).filter(PostLike.post_id == post_id).scalar() or 0
    if existing:
        return {"message": "Already liked", "likes_count": likes_count}

    db.add(PostLike(user_id=current_user.user_id, post_id=post_id))
    db.commit()
    # Notify post author
    actor_name = current_user.full_name or current_user.username or "Someone"
    create_notification(
        db,
        recipient_id=post.author_id,
        actor_id=current_user.user_id,
        notif_type="LIKE",
        message=f"{actor_name} liked your concept.",
        entity_type="POST",
        entity_id=post_id,
    )
    db.commit()
    new_count = (db.query(func.count(PostLike.like_id)).filter(PostLike.post_id == post_id).scalar() or 0)
    return {"message": "Liked", "likes_count": new_count}


@router.delete("/api/posts/{post_id}/like", status_code=status.HTTP_200_OK)
def unlike_post(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(PostLike).filter(
        PostLike.post_id == post_id, PostLike.user_id == current_user.user_id
    ).first()
    if not existing:
        return {"message": "Not liked"}
    db.delete(existing)
    db.commit()
    new_count = db.query(func.count(PostLike.like_id)).filter(PostLike.post_id == post_id).scalar() or 0
    return {"message": "Unliked", "likes_count": new_count}


# ─── Bookmarks ──────────────────────────────────────────────────────────────────

@router.post("/api/posts/{post_id}/bookmark", status_code=status.HTTP_200_OK)
def bookmark_post(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(Bookmark).filter(
        Bookmark.post_id == post_id, Bookmark.user_id == current_user.user_id
    ).first()
    if existing:
        return {"message": "Already bookmarked"}

    db.add(Bookmark(user_id=current_user.user_id, post_id=post_id))
    db.commit()
    return {"message": "Bookmarked"}


@router.delete("/api/posts/{post_id}/bookmark", status_code=status.HTTP_200_OK)
def remove_bookmark(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(Bookmark).filter(
        Bookmark.post_id == post_id, Bookmark.user_id == current_user.user_id
    ).first()
    if not existing:
        return {"message": "Not bookmarked"}
    db.delete(existing)
    db.commit()
    return {"message": "Bookmark removed"}


@router.get("/api/bookmarks")
def get_my_bookmarks(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bms = (
        db.query(Bookmark)
        .filter(Bookmark.user_id == current_user.user_id)
        .order_by(desc(Bookmark.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    posts = [bm.post for bm in bms if bm.post]
    return _serialize_posts_batched(posts, current_user.user_id, db)


# ─── Comments ──────────────────────────────────────────────────────────────────

def _serialize_comment(c: Comment) -> dict:
    return {
        "comment_id": str(c.comment_id),
        "post_id": str(c.post_id),
        "author_id": str(c.author_id),
        "author_username": c.author.username if c.author else None,
        "author_full_name": c.author.full_name if c.author else None,
        "author_avatar_url": None,
        "parent_comment_id": str(c.parent_comment_id) if c.parent_comment_id else None,
        "body": c.body,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "replies": [_serialize_comment(r) for r in (c.replies or [])],
    }


@router.get("/api/posts/{post_id}/comments")
def get_comments(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only top-level comments (replies are nested)
    comments = (
        db.query(Comment)
        .filter(Comment.post_id == post_id, Comment.parent_comment_id == None)
        .order_by(Comment.created_at)
        .all()
    )
    return [_serialize_comment(c) for c in comments]


@router.post("/api/posts/{post_id}/comments", status_code=status.HTTP_201_CREATED)
def add_comment(
    post_id: uuid.UUID,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = Comment(
        post_id=post_id,
        author_id=current_user.user_id,
        parent_comment_id=payload.parent_comment_id,
        body=payload.body,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    # Notify post author
    actor_name = current_user.full_name or current_user.username or "Someone"
    if payload.parent_comment_id:
        # Reply — notify parent comment author
        parent = db.query(Comment).filter(Comment.comment_id == payload.parent_comment_id).first()
        if parent:
            create_notification(
                db,
                recipient_id=parent.author_id,
                actor_id=current_user.user_id,
                notif_type="REPLY",
                message=f"{actor_name} replied to your comment.",
                entity_type="COMMENT",
                entity_id=comment.comment_id,
            )
    else:
        create_notification(
            db,
            recipient_id=post.author_id,
            actor_id=current_user.user_id,
            notif_type="COMMENT",
            message=f"{actor_name} commented on your concept.",
            entity_type="POST",
            entity_id=post_id,
        )
    db.commit()
    return _serialize_comment(comment)


@router.delete("/api/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.comment_id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your comment")
    db.delete(comment)
    db.commit()
