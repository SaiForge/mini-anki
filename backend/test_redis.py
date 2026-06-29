import asyncio
import json
import uuid
import sys
import os
import datetime

# Add app to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.redis import init_redis, close_redis, get_redis_sync

async def main():
    await init_redis()
    
    test_user_id = "aa93f179-9924-4519-b4c3-234cda3aa39e"
    
    # Publish message
    redis_sync = get_redis_sync()
    test_msg = {
        "message_id": str(uuid.uuid4()), 
        "sender_id": "test-sender-id",
        "recipient_id": test_user_id,
        "body": "Hello from Redis Test Script!",
        "is_read": False,
        "is_edited": False,
        "created_at": datetime.datetime.now().isoformat(),
        "sender_username": "system",
        "sender_full_name": "System Message",
        "sender_avatar_url": None
    }
    
    print(f"Publishing message to dm:{test_user_id}")
    redis_sync.publish(f"dm:{test_user_id}", json.dumps(test_msg))
    print("Done")
    
    await close_redis()

if __name__ == "__main__":
    asyncio.run(main())
