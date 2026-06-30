# app/api/notification_router.py
"""
Phase 4: Real-time Notifications API
Auto-creates notifications when social events happen.
Endpoints:
  GET    /api/notifications               - paginated inbox
  GET    /api/notifications/unread-count  - badge count
  PUT    /api/notifications/{id}/read     - mark one read
  PUT    /api/notifications/read-all      - mark all read
  DELETE /api/notifications/{id}          - delete one
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import uuid
from datetime import datetime

from app.db.database import get_db
from app.models.all_models import Notification, User
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


# ─── Helper: create a notification (called from other routers) ─────────────────
def create_notification(
    db: Session,
    recipient_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    notif_type: str,
    message: str,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
) -> Notification:
    """Create and persist a notification. Silent no-op if recipient == actor."""
    if actor_id and str(actor_id) == str(recipient_id):
        return None  # Don't notify yourself
    n = Notification(
        recipient_id=recipient_id,
        actor_id=actor_id,
        type=notif_type,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(n)
    return n


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = db.query(Notification).filter(
        Notification.recipient_id == current_user.user_id,
        Notification.is_read == False,
    ).count()
    return {"unread_count": count}


@router.get("")
def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(30, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifs = (
        db.query(Notification)
        .filter(Notification.recipient_id == current_user.user_id)
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_serialize(n) for n in notifs]


@router.put("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.recipient_id == current_user.user_id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}


@router.put("/{notification_id}/read")
def mark_one_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.notification_id == notification_id,
        Notification.recipient_id == current_user.user_id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return _serialize(n)


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.notification_id == notification_id,
        Notification.recipient_id == current_user.user_id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(n)
    db.commit()
    return {"deleted": True}


def _serialize(n: Notification) -> dict:
    actor_name = None
    actor_username = None
    actor_avatar = None
    if n.actor:
        actor_name = n.actor.full_name or n.actor.username
        actor_username = n.actor.username
        actor_avatar = None
    return {
        "notification_id": str(n.notification_id),
        "type": n.type,
        "message": n.message,
        "entity_type": n.entity_type,
        "entity_id": str(n.entity_id) if n.entity_id else None,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "actor": {
            "name": actor_name,
            "username": actor_username,
            "avatar_url": actor_avatar,
        } if n.actor_id else None,
    }
