import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from app.db.database import get_db
from app.models.all_models import User, Post, PostLike, Bookmark, Comment, Follow
from app.api.deps import get_current_user
from app.api.notification_router import create_notification

router = APIRouter(tags=["Feed"])


# ─── Pydantic Schemas ──────────────────────────────────────────────────────────

class PostCreate(BaseModel):
    content_type: str = "CONCEPT"
    title: Optional[str] = None
    body: str
    code_snippet: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    is_private: bool = False
    deck_id: Optional[uuid.UUID] = None


class PostUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    code_snippet: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    is_private: Optional[bool] = None


class CommentCreate(BaseModel):
    body: str
    parent_comment_id: Optional[uuid.UUID] = None


def _serialize_post(post: Post, current_user_id, db: Session) -> dict:
    """Convert a Post ORM object to a JSON-safe dict with like/bookmark status."""
    likes_count = len(post.likes)
    comments_count = len(post.comments)
    bookmarks_count = len(post.bookmarks)

    is_liked = db.query(PostLike).filter(
        PostLike.post_id == post.post_id,
        PostLike.user_id == current_user_id
    ).first() is not None

    is_bookmarked = db.query(Bookmark).filter(
        Bookmark.post_id == post.post_id,
        Bookmark.user_id == current_user_id
    ).first() is not None

    is_followed = db.query(Follow).filter(
        Follow.follower_id == current_user_id,
        Follow.following_id == post.author_id
    ).first() is not None

    author = post.author
    return {
        "post_id": str(post.post_id),
        "author_id": str(post.author_id),
        "author_username": author.username if author else None,
        "author_full_name": author.full_name if author else None,
        "author_avatar_url": author.profile_picture_url if author else None,
        "author_streak": author.current_streak if author else 0,
        "content_type": post.content_type,
        "title": post.title,
        "body": post.body,
        "code_snippet": post.code_snippet,
        "image_url": post.image_url,
        "category": post.category,
        "is_private": post.is_private,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "likes_count": likes_count,
        "comments_count": comments_count,
        "bookmarks_count": bookmarks_count,
        "is_liked": is_liked,
        "is_bookmarked": is_bookmarked,
        "is_followed": is_followed,
    }


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
    return _serialize_post(post, current_user.user_id, db)


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
    return _serialize_post(post, current_user.user_id, db)


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
    return _serialize_post(post, current_user.user_id, db)


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


# ─── Feed Endpoints ─────────────────────────────────────────────────────────────

@router.get("/api/feed/for-you")
def get_for_you_feed(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns posts from followed users + popular posts, newest first."""
    # Get IDs of users current user follows
    following_ids = [
        f.following_id
        for f in db.query(Follow).filter(Follow.follower_id == current_user.user_id).all()
    ]
    # Include own posts too
    following_ids.append(current_user.user_id)

    posts = (
        db.query(Post)
        .filter(Post.author_id.in_(following_ids), Post.is_private == False)
        .order_by(desc(Post.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    # If feed is thin, pad with public posts from anyone
    if len(posts) < limit:
        extra_ids = {p.post_id for p in posts}
        extra = (
            db.query(Post)
            .filter(Post.is_private == False, ~Post.post_id.in_(extra_ids))
            .order_by(desc(Post.created_at))
            .limit(limit - len(posts))
            .all()
        )
        posts = posts + extra

    return [_serialize_post(p, current_user.user_id, db) for p in posts]


@router.get("/api/feed/following")
def get_following_feed(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Strictly chronological feed from followed users only."""
    following_ids = [
        f.following_id
        for f in db.query(Follow).filter(Follow.follower_id == current_user.user_id).all()
    ]
    if not following_ids:
        return []

    posts = (
        db.query(Post)
        .filter(Post.author_id.in_(following_ids), Post.is_private == False)
        .order_by(desc(Post.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_serialize_post(p, current_user.user_id, db) for p in posts]


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
    return [_serialize_post(p, current_user.user_id, db) for p in posts]


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
    if existing:
        return {"message": "Already liked", "likes_count": len(post.likes)}

    db.add(PostLike(user_id=current_user.user_id, post_id=post_id))
    db.commit()
    db.refresh(post)
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
    return {"message": "Liked", "likes_count": len(post.likes)}


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
    post = db.query(Post).filter(Post.post_id == post_id).first()
    return {"message": "Unliked", "likes_count": len(post.likes) if post else 0}


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
    return [_serialize_post(p, current_user.user_id, db) for p in posts]


# ─── Comments ──────────────────────────────────────────────────────────────────

def _serialize_comment(c: Comment) -> dict:
    return {
        "comment_id": str(c.comment_id),
        "post_id": str(c.post_id),
        "author_id": str(c.author_id),
        "author_username": c.author.username if c.author else None,
        "author_full_name": c.author.full_name if c.author else None,
        "author_avatar_url": c.author.profile_picture_url if c.author else None,
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
