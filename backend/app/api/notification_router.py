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
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import uuid
from datetime import datetime
import json
import asyncio

from app.db.redis import get_redis_sync, get_redis_async

from app.db.database import get_db
from app.models.all_models import Notification, User
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


class NotificationConnectionManager:
    def __init__(self):
        self.active_connections: dict[uuid.UUID, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: uuid.UUID):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: uuid.UUID):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: uuid.UUID):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)

manager = NotificationConnectionManager()


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
    db.commit()
    db.refresh(n)

    # Publish to Redis for real-time delivery
    redis_sync = get_redis_sync()
    if redis_sync:
        msg_str = json.dumps(_serialize(n))
        try:
            print(f"Publishing to Redis notif:{recipient_id}")
            redis_sync.publish(f"notif:{recipient_id}", msg_str)
        except Exception as e:
            print(f"Redis publish error: {e}")

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


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: uuid.UUID):
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
                    print(f"WS listener got notif for {user_id}")
                    await manager.send_personal_message(data, user_id)
                except Exception as e:
                    print(f"WS send notif error: {e}")

    if redis_async:
        pubsub = redis_async.pubsub()
        await pubsub.subscribe(f"notif:{user_id}")
        listener_task = asyncio.create_task(redis_listener())

    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        if pubsub:
            await pubsub.unsubscribe(f"notif:{user_id}")
            await pubsub.close()
        if listener_task:
            listener_task.cancel()
