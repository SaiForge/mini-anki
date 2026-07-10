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
from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, desc
from pydantic import BaseModel, Field
from datetime import datetime
import json
import asyncio

from app.db.database import get_db
from app.models.all_models import DirectMessage, User
from app.api.deps import get_current_user
from app.api.notification_router import create_notification
from app.db.redis import get_redis_sync, get_redis_async
# SECURITY FIX (Critical #2): JWT imports for WebSocket authentication
from jose import jwt, JWTError
from app.core.security import SECRET_KEY, ALGORITHM

router = APIRouter(prefix="/api/dm", tags=["Direct Messages"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[uuid.UUID, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: uuid.UUID):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        print(f"WS connected for user: {user_id}. Active: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: uuid.UUID):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
            print(f"WS disconnected for user: {user_id}")

    async def send_personal_message(self, message: dict, user_id: uuid.UUID):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()


class MessageCreate(BaseModel):
    # SECURITY FIX (Medium #9): Cap message size — prevents storage exhaustion / DoS.
    # 4000 chars aligns with WhatsApp/Twitter norms and prevents DB bloat.
    body: str = Field(..., min_length=1, max_length=4000)


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
        "sender_avatar_url": None,
    }


@router.get("/unread-count")
def get_dm_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = db.query(DirectMessage.sender_id).filter(
        DirectMessage.recipient_id == current_user.user_id,
        DirectMessage.is_read == False,
    ).distinct().count()
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
                "partner_avatar_url": None,
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

    serialized_msg = _serialize_msg(msg)

    # Publish to Redis for real-time delivery
    redis_sync = get_redis_sync()
    if redis_sync:
        msg_str = json.dumps(serialized_msg)
        try:
            print(f"Publishing to Redis dm:{user_id} and dm:{current_user.user_id}")
            redis_sync.publish(f"dm:{user_id}", msg_str)
            redis_sync.publish(f"dm:{current_user.user_id}", msg_str)
        except Exception as e:
            print(f"Redis publish error: {e}")
    else:
        print("Redis sync client not available")

    return serialized_msg


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


@router.delete("/conversation/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete all messages between current user and a specific user."""
    db.query(DirectMessage).filter(
        or_(
            and_(DirectMessage.sender_id == current_user.user_id, DirectMessage.recipient_id == user_id),
            and_(DirectMessage.sender_id == user_id, DirectMessage.recipient_id == current_user.user_id)
        )
    ).delete(synchronize_session=False)
    db.commit()


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


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: uuid.UUID,
    # SECURITY FIX (Critical #2): Require JWT as a query param.
    # WHY: WebSocket handshakes don’t support Authorization headers in all browsers.
    # The token is validated before accepting the connection — unauthenticated
    # connections are rejected with code 1008 (Policy Violation).
    token: str = Query(..., description="JWT access token"),
):
    # Validate token before accepting the WebSocket connection
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_user_id = uuid.UUID(payload.get("sub", ""))
    except (JWTError, ValueError):
        await websocket.close(code=1008)  # 1008 = Policy Violation
        return

    # Ensure the token owner matches the requested DM channel
    # (prevents user A from subscribing to user B’s real-time messages)
    if token_user_id != user_id:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)
    redis_async = get_redis_async()
    pubsub = None
    listener_task = None

    async def redis_listener():
        if not pubsub:
            return
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    await manager.send_personal_message(data, user_id)
                except Exception as e:
                    print(f"WS send error: {e}")

    if redis_async:
        pubsub = redis_async.pubsub()
        await pubsub.subscribe(f"dm:{user_id}")
        listener_task = asyncio.create_task(redis_listener())

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        if pubsub:
            await pubsub.unsubscribe(f"dm:{user_id}")
            await pubsub.close()
        if listener_task:
            listener_task.cancel()
