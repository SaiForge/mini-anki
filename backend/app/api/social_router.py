import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.all_models import User, Follow
from app.api.deps import get_current_user
from app.schemas.user_schema import PublicUserResponse
from uuid import UUID
from app.api.notification_router import create_notification

router = APIRouter(prefix="/api/social", tags=["Social"])

@router.post("/follow/{user_id}", status_code=status.HTTP_200_OK)
def follow_user(user_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    target_user = db.query(User).filter(User.user_id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing_follow = db.query(Follow).filter(
        Follow.follower_id == current_user.user_id,
        Follow.following_id == user_id
    ).first()

    if existing_follow:
        return {"message": "Already following this user"}

    new_follow = Follow(follower_id=current_user.user_id, following_id=user_id)
    db.add(new_follow)
    db.commit()
    # Notify the person being followed
    actor_name = current_user.full_name or current_user.username or "Someone"
    create_notification(
        db,
        recipient_id=user_id,
        actor_id=current_user.user_id,
        notif_type="FOLLOW",
        message=f"{actor_name} started following you.",
        entity_type="USER",
        entity_id=current_user.user_id,
    )
    db.commit()
    return {"message": f"Successfully followed {target_user.username}"}

@router.delete("/unfollow/{user_id}", status_code=status.HTTP_200_OK)
def unfollow_user(user_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing_follow = db.query(Follow).filter(
        Follow.follower_id == current_user.user_id,
        Follow.following_id == user_id
    ).first()

    if not existing_follow:
        return {"message": "Not following this user"}

    db.delete(existing_follow)
    db.commit()

    return {"message": "Successfully unfollowed user"}

@router.get("/{user_id}/followers", response_model=list[PublicUserResponse])
def get_followers(user_id: UUID, db: Session = Depends(get_db)):
    followers_links = db.query(Follow).filter(Follow.following_id == user_id).all()
    follower_ids = [f.follower_id for f in followers_links]

    users = db.query(User).filter(User.user_id.in_(follower_ids)).all()

    results = []
    for u in users:
        f_count = db.query(Follow).filter(Follow.following_id == u.user_id).count()
        f_ing_count = db.query(Follow).filter(Follow.follower_id == u.user_id).count()
        results.append({
            "user_id": u.user_id,
            "username": u.username,
            "full_name": u.full_name,
            "bio": u.bio,
            "website_url": u.website_url,
            "location": u.location,
            "tags": u.tags,
            "current_streak": u.current_streak,
            "followers_count": f_count,
            "following_count": f_ing_count
        })

    return results

@router.get("/{user_id}/following", response_model=list[PublicUserResponse])
def get_following(user_id: UUID, db: Session = Depends(get_db)):
    following_links = db.query(Follow).filter(Follow.follower_id == user_id).all()
    following_ids = [f.following_id for f in following_links]

    users = db.query(User).filter(User.user_id.in_(following_ids)).all()

    results = []
    for u in users:
        f_count = db.query(Follow).filter(Follow.following_id == u.user_id).count()
        f_ing_count = db.query(Follow).filter(Follow.follower_id == u.user_id).count()
        results.append({
            "user_id": u.user_id,
            "username": u.username,
            "full_name": u.full_name,
            "bio": u.bio,
            "website_url": u.website_url,
            "location": u.location,
            "tags": u.tags,
            "current_streak": u.current_streak,
            "followers_count": f_count,
            "following_count": f_ing_count
        })

    return results

@router.get("/is-following/{user_id}")
def is_following(user_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing_follow = db.query(Follow).filter(
        Follow.follower_id == current_user.user_id,
        Follow.following_id == user_id
    ).first()

    return {"is_following": existing_follow is not None}
