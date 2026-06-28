# app/api/dm_router.py
"""
Phase 5: Direct Messaging API
GET    /api/dm/conversations          - list all DM threads (unique partners)
GET    /api/dm/{user_id}              - get messages with a specific user
POST   /api/dm/{user_id}             - send a message to a user
PUT    /api/dm/{user_id}/read        - mark all messages from user as read
GET    /api/dm/unread-count          - total unread DM count
DELETE /api/dm/{message_id}          - delete own message
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, desc
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.models.all_models import DirectMessage, User
from app.api.deps import get_current_user
from app.api.notification_router import create_notification

router = APIRouter(prefix="/api/dm", tags=["Direct Messages"])


class MessageCreate(BaseModel):
    body: str


def _serialize_msg(m: DirectMessage) -> dict:
    return {
        "message_id": str(m.message_id),
        "sender_id": str(m.sender_id),
        "recipient_id": str(m.recipient_id),
        "body": m.body,
        "is_read": m.is_read,
        "is_edited": m.is_edited or False,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "sender_username": m.sender.username if m.sender else None,
        "sender_full_name": m.sender.full_name if m.sender else None,
        "sender_avatar_url": m.sender.profile_picture_url if m.sender else None,
    }


@router.get("/unread-count")
def get_dm_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = db.query(DirectMessage).filter(
        DirectMessage.recipient_id == current_user.user_id,
        DirectMessage.is_read == False,
    ).count()
    return {"unread_count": count}


@router.get("/conversations")
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return one entry per unique conversation partner, with last message."""
    # Get all partners
    my_id = current_user.user_id

    # All messages involving me
    msgs = (
        db.query(DirectMessage)
        .filter(
            or_(
                DirectMessage.sender_id == my_id,
                DirectMessage.recipient_id == my_id,
            )
        )
        .order_by(desc(DirectMessage.created_at))
        .all()
    )

    # Build conversation map (partner_id → last message)
    seen = {}
    for m in msgs:
        partner_id = str(m.recipient_id) if str(m.sender_id) == str(my_id) else str(m.sender_id)
        if partner_id not in seen:
            partner = m.recipient if str(m.sender_id) == str(my_id) else m.sender
            unread = db.query(DirectMessage).filter(
                DirectMessage.sender_id == uuid.UUID(partner_id),
                DirectMessage.recipient_id == my_id,
                DirectMessage.is_read == False,
            ).count()
            seen[partner_id] = {
                "partner_id": partner_id,
                "partner_username": partner.username if partner else None,
                "partner_full_name": partner.full_name if partner else None,
                "partner_avatar_url": partner.profile_picture_url if partner else None,
                "last_message": m.body[:80],
                "last_message_at": m.created_at.isoformat() if m.created_at else None,
                "unread_count": unread,
                "is_mine": str(m.sender_id) == str(my_id),
            }

    return list(seen.values())


@router.get("/{user_id}")
def get_thread(
    user_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full message thread with a specific user."""
    msgs = (
        db.query(DirectMessage)
        .filter(
            or_(
                and_(DirectMessage.sender_id == current_user.user_id, DirectMessage.recipient_id == user_id),
                and_(DirectMessage.sender_id == user_id, DirectMessage.recipient_id == current_user.user_id),
            )
        )
        .order_by(DirectMessage.created_at)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_serialize_msg(m) for m in msgs]


@router.post("/{user_id}", status_code=status.HTTP_201_CREATED)
def send_message(
    user_id: uuid.UUID,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a DM to another user."""
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    target = db.query(User).filter(User.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    msg = DirectMessage(
        sender_id=current_user.user_id,
        recipient_id=user_id,
        body=payload.body,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Notifications for DMs are disabled per user request
    # actor_name = current_user.full_name or current_user.username or "Someone"
    # create_notification(
    #     db,
    #     recipient_id=user_id,
    #     actor_id=current_user.user_id,
    #     notif_type="SYSTEM",
    #     message=f"{actor_name} sent you a message.",
    #     entity_type="USER",
    #     entity_id=current_user.user_id,
    # )
    # db.commit()

    return _serialize_msg(msg)


@router.put("/{user_id}/read")
def mark_thread_read(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all messages from a specific user as read."""
    db.query(DirectMessage).filter(
        DirectMessage.sender_id == user_id,
        DirectMessage.recipient_id == current_user.user_id,
        DirectMessage.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "Thread marked as read"}


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(
    message_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = db.query(DirectMessage).filter(DirectMessage.message_id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Cannot delete others' messages")
    db.delete(msg)
    db.commit()


class MessageUpdate(BaseModel):
    body: str


@router.put("/message/{message_id}")
def edit_message(
    message_id: uuid.UUID,
    payload: MessageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit the body of your own message."""
    msg = db.query(DirectMessage).filter(DirectMessage.message_id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Cannot edit others' messages")
    if not payload.body.strip():
        raise HTTPException(status_code=400, detail="Message body cannot be empty")
    msg.body = payload.body.strip()
    msg.is_edited = True
    db.commit()
    db.refresh(msg)
    return _serialize_msg(msg)
